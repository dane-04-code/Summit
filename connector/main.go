package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

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

	conn, _, err := websocket.DefaultDialer.Dial(relayURL, nil)
	if err != nil {
		log.Fatalf("dial relay %s: %v", relayURL, err)
	}
	defer conn.Close()
	log.Printf("connected to relay %s", relayURL)

	if err := conn.WriteJSON(Frame{
		T: "hello", Framework: "hermes", AgentName: "Hermes", AgentVersion: "1.0",
	}); err != nil {
		log.Fatalf("send hello: %v", err)
	}

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("relay closed: %v", err)
			return
		}
		var f Frame
		if err := json.Unmarshal(msg, &f); err != nil {
			log.Printf("bad frame: %v", err)
			continue
		}
		switch f.T {
		case "code":
			fmt.Printf("\n  Pairing code: %s\n\n  Enter this code in the Summit app.\n\n", f.Code)
		case "chat":
			go handleChat(conn, f, hermesBase, apiKey)
		case "peer_gone":
			fmt.Println("App disconnected — waiting for reconnect.")
		default:
			log.Printf("unknown frame %q", f.T)
		}
	}
}

func handleChat(conn *websocket.Conn, f Frame, hermesBase, apiKey string) {
	for frame := range streamChat(f.Messages, hermesBase, apiKey) {
		frame.ReqID = f.ReqID
		if err := conn.WriteJSON(frame); err != nil {
			log.Printf("write frame: %v", err)
			return
		}
	}
}
