package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Frame is the shared JSON envelope for all relay protocol messages.
type Frame struct {
	T              string        `json:"t"`
	Framework      string        `json:"framework,omitempty"`
	AgentName      string        `json:"agentName,omitempty"`
	AgentVersion   string        `json:"agentVersion,omitempty"`
	Code           string        `json:"code,omitempty"`
	ConnectorToken string        `json:"connectorToken,omitempty"`
	ReqID          string        `json:"reqId,omitempty"`
	Delta          string        `json:"delta,omitempty"`
	Message        string        `json:"message,omitempty"`
	Messages       []ChatMessage `json:"messages,omitempty"`
	SessionID      string        `json:"sessionId,omitempty"`
	SessionKey     string        `json:"sessionKey,omitempty"`
	Method         string        `json:"method,omitempty"`
	Path           string        `json:"path,omitempty"`
	Status         int           `json:"status,omitempty"`
	Body           string        `json:"body,omitempty"`
	Title          string        `json:"title,omitempty"`
	// Push approvals (OpenClaw): connector → app `approval_req`, app →
	// connector `approval_resolve` with decision approve|deny.
	ApprovalID string `json:"approvalId,omitempty"`
	Command    string `json:"command,omitempty"`
	Decision   string `json:"decision,omitempty"`
}

// ChatMessage matches the OpenAI messages array shape.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// agentIdentity resolves what the connector announces in its hello frame.
// AGENT_FRAMEWORK defaults to hermes; any OpenAI-compatible upstream can set
// AGENT_FRAMEWORK=openai (and optionally AGENT_NAME) so the app surfaces only
// the features that agent actually has.
func agentIdentity(frameworkEnv, nameEnv string) (string, string) {
	framework := strings.ToLower(strings.TrimSpace(frameworkEnv))
	if framework == "" {
		framework = "hermes"
	}
	name := strings.TrimSpace(nameEnv)
	if name == "" {
		if framework == "hermes" {
			name = "Hermes"
		} else {
			name = "Agent"
		}
	}
	return framework, name
}

func main() {
	relayURL := os.Getenv("RELAY_URL")
	if relayURL == "" {
		relayURL = "ws://localhost:8787"
	}
	hermesBase := strings.TrimRight(os.Getenv("HERMES_BASE_URL"), "/")
	apiKey := os.Getenv("HERMES_API_KEY")
	framework, agentName := agentIdentity(os.Getenv("AGENT_FRAMEWORK"), os.Getenv("AGENT_NAME"))
	openclawWSURL := strings.TrimRight(os.Getenv("OPENCLAW_WS_URL"), "/")
	openclawToken := os.Getenv("OPENCLAW_TOKEN")

	if framework != "openclaw" && (hermesBase == "" || apiKey == "") {
		log.Fatal("HERMES_BASE_URL and HERMES_API_KEY must be set")
	}
	if hermesBase != "" && !strings.HasPrefix(hermesBase, "http") {
		hermesBase = "http://" + hermesBase
	}

	// Local nudge endpoint: agent-side callers POST {title, body} and the
	// paired phone gets a push when the app is away. See notify.go.
	notify := &notifier{}
	notifyPort := os.Getenv("NOTIFY_PORT")
	if notifyPort == "" {
		notifyPort = "8643"
	}
	startNotifyServer(notify, notifyPort)

	for {
		if err := run(relayURL, hermesBase, apiKey, framework, agentName, openclawWSURL, openclawToken, notify); err != nil {
			log.Printf("disconnected: %v — reconnecting in 5s", err)
		}
		time.Sleep(5 * time.Second)
	}
}

func savedRelayIdentity() (string, string) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", ""
	}
	dir := filepath.Join(home, ".summit")
	code, _ := os.ReadFile(filepath.Join(dir, "pairing_code"))
	token, _ := os.ReadFile(filepath.Join(dir, "connector_token"))
	return strings.TrimSpace(string(code)), strings.TrimSpace(string(token))
}

func run(relayURL, hermesBase, apiKey, framework, agentName, openclawWSURL, openclawToken string, notify *notifier) error {
	target := relayURL
	if code, token := savedRelayIdentity(); code != "" {
		target += "?claim=" + url.QueryEscape(code)
		if token != "" {
			target += "&token=" + url.QueryEscape(token)
		}
	}
	conn, _, err := websocket.DefaultDialer.Dial(target, nil)
	if err != nil {
		return fmt.Errorf("dial relay %s: %w", relayURL, err)
	}
	defer conn.Close()
	var writeMu sync.Mutex
	log.Printf("connected to relay %s", relayURL)

	notify.setSender(func(f Frame) error { return writeFrame(conn, &writeMu, f) })
	defer notify.setSender(nil)

	if err := writeFrame(conn, &writeMu, Frame{
		T: "hello", Framework: framework, AgentName: agentName, AgentVersion: "1.0",
	}); err != nil {
		return fmt.Errorf("send hello: %w", err)
	}

	// For OpenClaw, open the persistent WS control plane to the local Gateway.
	// Chat is bridged through it instead of Hermes HTTP.
	var oc *ocClient
	if framework == "openclaw" {
		if openclawWSURL == "" || openclawToken == "" {
			return fmt.Errorf("OPENCLAW_WS_URL and OPENCLAW_TOKEN must be set for openclaw")
		}
		oc, err = dialOpenClaw(openclawWSURL, openclawToken, "main")
		if err != nil {
			return fmt.Errorf("openclaw dial: %w", err)
		}
		defer oc.close()
		// The Gateway pushes exec approvals over the persistent WS; forward
		// each to the app as an approval_req frame.
		oc.setOnApproval(func(ap ocApproval) {
			if err := writeFrame(conn, &writeMu, Frame{T: "approval_req", ApprovalID: ap.ID, Command: ap.Command}); err != nil {
				log.Printf("write approval_req: %v", err)
			}
		})
	}

	// Keep the Cloudflare connection alive with application-level heartbeats.
	// Cloudflare's idle timer resets on JSON messages, not WebSocket control pings.
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := writeFrame(conn, &writeMu, Frame{T: "ping"}); err != nil {
				return
			}
		}
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("relay closed: %w", err)
		}
		var f Frame
		if err := json.Unmarshal(msg, &f); err != nil {
			log.Printf("bad frame: %v", err)
			continue
		}
		switch f.T {
		case "code":
			fmt.Printf("\n┌──────────────────────────┐\n│   Pairing code: %-6s   │\n└──────────────────────────┘\n\nEnter this code in the Summit app. Never share it with anyone else.\n\n", f.Code)
			if home, err := os.UserHomeDir(); err == nil {
				dir := filepath.Join(home, ".summit")
				os.MkdirAll(dir, 0700)
				os.WriteFile(filepath.Join(dir, "pairing_code"), []byte(f.Code+"\n"), 0600)
				os.WriteFile(filepath.Join(dir, "connector_token"), []byte(f.ConnectorToken+"\n"), 0600)
			}
		case "chat":
			if oc != nil {
				go handleChatOpenClaw(conn, &writeMu, f, oc)
			} else {
				go handleChat(conn, &writeMu, f, f.SessionID, f.SessionKey, hermesBase, apiKey)
			}
		case "api_req":
			go handleApiReq(conn, &writeMu, f, hermesBase, apiKey)
		case "approval_resolve":
			if oc != nil {
				if err := oc.resolveApproval(f.ApprovalID, f.Decision); err != nil {
					log.Printf("approval resolve: %v", err)
				}
			}
		case "peer_gone":
			fmt.Println("App disconnected — waiting for reconnect.")
		case "pong":
			// heartbeat reply — nothing to do
		default:
			log.Printf("unknown frame %q", f.T)
		}
	}
}

func writeFrame(conn *websocket.Conn, writeMu *sync.Mutex, frame Frame) error {
	writeMu.Lock()
	defer writeMu.Unlock()
	return conn.WriteJSON(frame)
}

func handleChat(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, sessionID, sessionKey, hermesBase, apiKey string) {
	for frame := range streamChat(f.Messages, sessionID, sessionKey, hermesBase, apiKey) {
		frame.ReqID = f.ReqID
		if err := writeFrame(conn, writeMu, frame); err != nil {
			log.Printf("write frame: %v", err)
			return
		}
	}
}

// handleApiReq proxies a single allow-listed Hermes REST call (jobs, run
// approval/stop) and returns the status + raw body to the app.
func handleApiReq(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, hermesBase, apiKey string) {
	status, body := doAPI(f.Method, f.Path, f.Body, hermesBase, apiKey)
	if err := writeFrame(conn, writeMu, Frame{T: "api_res", ReqID: f.ReqID, Status: status, Body: body}); err != nil {
		log.Printf("write api_res: %v", err)
	}
}
