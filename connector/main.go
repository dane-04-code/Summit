package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// Frame is the shared JSON envelope for all relay protocol messages.
type Frame struct {
	T            string        `json:"t"`
	Framework    string        `json:"framework,omitempty"`
	AgentName    string        `json:"agentName,omitempty"`
	AgentVersion string        `json:"agentVersion,omitempty"`
	Code         string        `json:"code,omitempty"`
	ReqID        string        `json:"reqId,omitempty"`
	Delta        string        `json:"delta,omitempty"`
	Message      string        `json:"message,omitempty"`
	Messages     []ChatMessage `json:"messages,omitempty"`
	SessionID    string        `json:"sessionId,omitempty"`
	SessionKey   string        `json:"sessionKey,omitempty"`
}

// ChatMessage matches the OpenAI messages array shape.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func main() {
	relayURL := os.Getenv("RELAY_URL")
	if relayURL == "" {
		relayURL = "ws://localhost:8787"
	}
	hermesBase := strings.TrimRight(os.Getenv("HERMES_BASE_URL"), "/")
	apiKey := os.Getenv("HERMES_API_KEY")

	if hermesBase == "" || apiKey == "" {
		log.Fatal("HERMES_BASE_URL and HERMES_API_KEY must be set")
	}
	if !strings.HasPrefix(hermesBase, "http") {
		hermesBase = "http://" + hermesBase
	}

	for {
		if err := run(relayURL, hermesBase, apiKey); err != nil {
			log.Printf("disconnected: %v — reconnecting in 5s", err)
		}
		time.Sleep(5 * time.Second)
	}
}

func run(relayURL, hermesBase, apiKey string) error {
	conn, _, err := websocket.DefaultDialer.Dial(relayURL, nil)
	if err != nil {
		return fmt.Errorf("dial relay %s: %w", relayURL, err)
	}
	defer conn.Close()
	log.Printf("connected to relay %s", relayURL)

	if err := conn.WriteJSON(Frame{
		T: "hello", Framework: "hermes", AgentName: "Hermes", AgentVersion: "1.0",
	}); err != nil {
		return fmt.Errorf("send hello: %w", err)
	}

	// Keep the Cloudflare connection alive — it drops idle WebSockets after ~2 min.
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
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
			fmt.Printf("\n┌──────────────────────────┐\n│   Pairing code: %-6s   │\n└──────────────────────────┘\n\nEnter this code in the Summit app.\n\n", f.Code)
			if home, err := os.UserHomeDir(); err == nil {
				dir := filepath.Join(home, ".summit")
				os.MkdirAll(dir, 0700)
				os.WriteFile(filepath.Join(dir, "pairing_code"), []byte(f.Code+"\n"), 0600)
			}
		case "chat":
			go handleChat(conn, f, f.SessionID, f.SessionKey, hermesBase, apiKey)
		case "peer_gone":
			fmt.Println("App disconnected — waiting for reconnect.")
		default:
			log.Printf("unknown frame %q", f.T)
		}
	}
}

func handleChat(conn *websocket.Conn, f Frame, sessionID, sessionKey, hermesBase, apiKey string) {
	for frame := range streamChat(f.Messages, sessionID, sessionKey, hermesBase, apiKey) {
		frame.ReqID = f.ReqID
		if err := conn.WriteJSON(frame); err != nil {
			log.Printf("write frame: %v", err)
			return
		}
	}
}
