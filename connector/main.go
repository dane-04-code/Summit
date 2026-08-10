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
	T              string   `json:"t"`
	Framework      string   `json:"framework,omitempty"`
	AgentName      string   `json:"agentName,omitempty"`
	AgentVersion   string   `json:"agentVersion,omitempty"`
	Code           string   `json:"code,omitempty"`
	ConnectorToken string   `json:"connectorToken,omitempty"`
	Capabilities   []string `json:"capabilities,omitempty"`
	// ExpiresAt (epoch ms) is when the advertised code stops being pairable;
	// Paired marks a channel a phone has already claimed.
	ExpiresAt  int64         `json:"expiresAt,omitempty"`
	Paired     bool          `json:"paired,omitempty"`
	ReqID      string        `json:"reqId,omitempty"`
	Delta      string        `json:"delta,omitempty"`
	Message    string        `json:"message,omitempty"`
	Messages   []ChatMessage `json:"messages,omitempty"`
	SessionID  string        `json:"sessionId,omitempty"`
	SessionKey string        `json:"sessionKey,omitempty"`
	EventID    string        `json:"eventId,omitempty"`
	Label      string        `json:"label,omitempty"`
	Reply      *SettledReply `json:"reply,omitempty"`
	IDs        []string      `json:"ids,omitempty"`
	Method     string        `json:"method,omitempty"`
	Path       string        `json:"path,omitempty"`
	Status     int           `json:"status,omitempty"`
	Body       string        `json:"body,omitempty"`
	Title      string        `json:"title,omitempty"`
	// Push approvals (OpenClaw): connector → app `approval_req`, app →
	// connector `approval_resolve` with decision approve|deny.
	ApprovalID string `json:"approvalId,omitempty"`
	Command    string `json:"command,omitempty"`
	Decision   string `json:"decision,omitempty"`
	// Via distinguishes this hello as coming from the Go connector (fallback
	// path) vs a native framework plugin. The connector always sends "connector".
	Via string `json:"via,omitempty"`
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
	outbox, err := defaultReplyOutbox()
	if err != nil {
		log.Fatalf("open reply outbox: %v", err)
	}

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

	wait := backoffFloor
	for {
		connected, err := run(relayURL, hermesBase, apiKey, framework, agentName, openclawWSURL, openclawToken, notify, outbox)
		// Reaching the relay at all clears the penalty: the pause is there to
		// back off a relay that is refusing us, not to slow down a working one
		// that dropped. Code rotation relies on this — it deliberately closes a
		// live socket to fetch a fresh code, and must not be made to crawl.
		if connected {
			wait = backoffFloor
		} else {
			wait = nextBackoff(wait)
		}
		pause := jitter(wait)
		if err != nil {
			log.Printf("disconnected: %v — reconnecting in %s", err, pause.Round(time.Second))
		}
		time.Sleep(pause)
	}
}

func savedRelayIdentity() (string, string) {
	dir, err := summitDir()
	if err != nil {
		return "", ""
	}
	code, _ := os.ReadFile(filepath.Join(dir, "pairing_code"))
	token, _ := os.ReadFile(filepath.Join(dir, "connector_token"))
	trimmed := strings.TrimSpace(string(code))
	// A saved file that no longer looks like a code is worse than none: dialling
	// with it just fails the relay's format gate. Fall back to a fresh pairing.
	if !isChannelLocator(trimmed) {
		return "", ""
	}
	return trimmed, strings.TrimSpace(string(token))
}

// run holds one relay session open until it fails. The bool reports whether the
// socket was ever established, which is what the caller's backoff keys off:
// a refused dial should slow us down, a session that ran and ended should not.
func run(relayURL, hermesBase, apiKey, framework, agentName, openclawWSURL, openclawToken string, notify *notifier, outbox *replyOutbox) (bool, error) {
	target := relayURL
	if code, token := savedRelayIdentity(); code != "" {
		target += "?claim=" + url.QueryEscape(code)
		if token != "" {
			target += "&token=" + url.QueryEscape(token)
		}
	}
	conn, _, err := websocket.DefaultDialer.Dial(target, nil)
	if err != nil {
		return false, fmt.Errorf("dial relay %s: %w", relayURL, err)
	}
	defer conn.Close()
	var writeMu sync.Mutex
	log.Printf("connected to relay %s", relayURL)

	notify.setSender(func(f Frame) error { return writeFrame(conn, &writeMu, f) })
	defer notify.setSender(nil)

	// Advertising code_rotation is what lets the relay hand out a short-lived
	// code: we promise to fetch a replacement when it lapses, so the user is
	// never left staring at a dead one.
	if err := writeFrame(conn, &writeMu, Frame{
		T: "hello", Framework: framework, AgentName: agentName, AgentVersion: "1.0", Via: "connector",
		Capabilities: []string{"code_rotation"},
	}); err != nil {
		return true, fmt.Errorf("send hello: %w", err)
	}

	// Fires when the advertised code lapses unpaired: drop the saved channel and
	// close the socket, which drops us back into main's redial loop and mints a
	// fresh code. Stopped the moment a phone pairs, or when run() returns.
	var rotate *time.Timer
	defer func() {
		if rotate != nil {
			rotate.Stop()
		}
	}()

	// For OpenClaw, open the persistent WS control plane to the local Gateway.
	// Chat is bridged through it instead of Hermes HTTP.
	var oc *ocClient
	if framework == "openclaw" {
		if openclawWSURL == "" || openclawToken == "" {
			return true, fmt.Errorf("OPENCLAW_WS_URL and OPENCLAW_TOKEN must be set for openclaw")
		}
		oc, err = dialOpenClaw(openclawWSURL, openclawToken, "main")
		if err != nil {
			return true, fmt.Errorf("openclaw dial: %w", err)
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
			return true, fmt.Errorf("relay closed: %w", err)
		}
		var f Frame
		if err := json.Unmarshal(msg, &f); err != nil {
			log.Printf("bad frame: %v", err)
			continue
		}
		switch f.T {
		case "code":
			if err := saveRelayIdentity(f.Code, f.ConnectorToken); err != nil {
				log.Printf("save relay identity: %v", err)
			}
			if rotate != nil {
				rotate.Stop()
				rotate = nil
			}
			if f.Paired {
				fmt.Print("\nPaired with your phone. Waiting for messages.\n\n")
				break
			}
			fmt.Printf("\n┌────────────────────────────┐\n│  Pairing code: %-9s   │\n└────────────────────────────┘\n\nEnter this code in the Summit app. Never share it with anyone else.\n\n", formatPairingCode(f.Code))
			if f.ExpiresAt > 0 {
				// Give the window a floor: a clock skewed past the deadline
				// would otherwise spin us through codes as fast as we can dial.
				wait := time.Until(time.UnixMilli(f.ExpiresAt))
				if wait < 5*time.Second {
					wait = 5 * time.Second
				}
				rotate = time.AfterFunc(wait, func() {
					fmt.Print("\nThat code expired unused — fetching a fresh one.\n\n")
					clearRelayIdentity()
					conn.Close() // unblocks ReadMessage; main redials without a claim
				})
			}
		case "pair_ok":
			if rotate != nil {
				rotate.Stop()
				rotate = nil
			}
			fmt.Print("\nPaired with your phone. Waiting for messages.\n\n")
		case "chat":
			if oc != nil {
				go handleChatOpenClaw(conn, &writeMu, f, oc, outbox)
			} else {
				go handleChat(conn, &writeMu, f, f.SessionID, f.SessionKey, hermesBase, apiKey, outbox)
			}
		case "sync_req":
			go handleSync(conn, &writeMu, f.ReqID, outbox)
		case "ack_replies":
			if err := outbox.ack(f.IDs); err != nil {
				log.Printf("ack reply outbox: %v", err)
			}
		case "api_req":
			go handleApiReq(conn, &writeMu, f, hermesBase, apiKey, oc)
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

func handleChat(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, sessionID, sessionKey, hermesBase, apiKey string, outbox *replyOutbox) {
	forwardChatFrames(conn, writeMu, f, streamChat(f.Messages, sessionID, sessionKey, hermesBase, apiKey), outbox)
}

func forwardChatFrames(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, frames <-chan Frame, outbox *replyOutbox) {
	var content strings.Builder
	activity := time.NewTicker(15 * time.Second)
	defer activity.Stop()
	for {
		var frame Frame
		select {
		case next, ok := <-frames:
			if !ok {
				return
			}
			frame = next
		case <-activity.C:
			if err := writeFrame(conn, writeMu, Frame{
				T: "activity", ReqID: f.ReqID, SessionID: f.SessionID, Label: "Thinking…",
			}); err != nil {
				log.Printf("write activity: %v", err)
			}
			continue
		}
		frame.ReqID = f.ReqID
		frame.SessionID = f.SessionID
		if frame.T == "chunk" {
			content.WriteString(frame.Delta)
		}
		if frame.T == "done" || frame.T == "error" {
			reply := SettledReply{
				ID: newEventID(), ReqID: f.ReqID, SessionID: f.SessionID,
				Status: frame.T, Content: content.String(), Error: frame.Message,
				CreatedAt: time.Now().UnixMilli(),
			}
			if err := outbox.add(reply); err != nil {
				log.Printf("save settled reply: %v", err)
			}
			frame.EventID = reply.ID
		}
		if err := writeFrame(conn, writeMu, frame); err != nil {
			log.Printf("write frame: %v", err)
			// The connector-owned turn and outbox continue even if the phone-side
			// delivery path disappears; a reconnect can sync the settled reply.
		}
	}
}

func handleSync(conn *websocket.Conn, writeMu *sync.Mutex, reqID string, outbox *replyOutbox) {
	for _, reply := range outbox.list() {
		r := reply
		if err := writeFrame(conn, writeMu, Frame{T: "sync_reply", ReqID: reqID, Reply: &r}); err != nil {
			log.Printf("write sync_reply: %v", err)
			return
		}
	}
	if err := writeFrame(conn, writeMu, Frame{T: "sync_done", ReqID: reqID}); err != nil {
		log.Printf("write sync_done: %v", err)
	}
}

// handleApiReq proxies a single allow-listed REST-shaped call and returns the
// status + raw body to the app. Hermes has a real REST API behind this
// (jobs, run approval/stop); OpenClaw doesn't, so the same paths are mapped
// onto the Gateway's WS cron.* methods instead — the app's adapter code is
// unaware of the difference (src/agents/adapters/relay.ts calls the same
// `this.api()` either way).
func handleApiReq(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, hermesBase, apiKey string, oc *ocClient) {
	var status int
	var body string
	if oc != nil {
		status, body = doOpenClawAPI(f.Method, f.Path, oc)
	} else {
		status, body = doAPI(f.Method, f.Path, f.Body, hermesBase, apiKey)
	}
	if err := writeFrame(conn, writeMu, Frame{T: "api_res", ReqID: f.ReqID, Status: status, Body: body}); err != nil {
		log.Printf("write api_res: %v", err)
	}
}
