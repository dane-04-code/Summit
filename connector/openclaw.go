package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gorilla/websocket"
)

// ocTickIntervalSeconds is the Gateway's policy.tickIntervalMs (30s) expressed
// in seconds. Silence beyond 2x this means the connection is dead
// (docs/openclaw-adapter-research.md §5). Phase 1 leans on the connector's outer
// reconnect loop rather than an in-client watchdog.
const ocTickIntervalSeconds = 30

// ocEvent is the minimal shape of an OpenClaw Gateway event frame we care about
// for Phase 1 chat. See docs/openclaw-adapter-research.md §3.
type ocEvent struct {
	Type    string `json:"type"`
	Event   string `json:"event"`
	Payload struct {
		RunID   string `json:"runId"`
		State   string `json:"state"`
		ErrMsg  string `json:"errorMessage"`
		Message struct {
			Role    string `json:"role"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"message"`
	} `json:"payload"`
}

// translateEvent maps one OpenClaw event frame to a relay Frame. It returns
// ok=false for frames the app doesn't need (user echo, agent lifecycle, events
// for a different turn). runID is the active turn (the idempotencyKey we sent);
// chat completion events for other runIds are ignored.
func translateEvent(raw []byte, runID string) (Frame, bool) {
	var ev ocEvent
	if err := json.Unmarshal(raw, &ev); err != nil {
		return Frame{}, false
	}
	switch ev.Event {
	case "session.message":
		if ev.Payload.Message.Role != "assistant" {
			return Frame{}, false
		}
		text := ""
		for _, c := range ev.Payload.Message.Content {
			if c.Type == "text" {
				text += c.Text
			}
		}
		if text == "" {
			return Frame{}, false
		}
		return Frame{T: "chunk", Delta: text}, true
	case "chat":
		if ev.Payload.RunID != runID {
			return Frame{}, false
		}
		switch ev.Payload.State {
		case "done":
			return Frame{T: "done"}, true
		case "error":
			return Frame{T: "error", Message: ev.Payload.ErrMsg}, true
		}
	}
	return Frame{}, false
}

// newID returns a random hex request id for gateway req frames.
func newID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func buildConnect(token string) ([]byte, string) {
	id := newID()
	req := map[string]any{
		"type":   "req",
		"id":     id,
		"method": "connect",
		"params": map[string]any{
			"minProtocol": 3,
			"maxProtocol": 3,
			"client": map[string]any{
				"id": "gateway-client", "version": "1.0.0", "platform": "connector", "mode": "backend",
			},
			"role":        "operator",
			"scopes":      []string{"operator.read", "operator.write", "operator.approvals"},
			"caps":        []string{},
			"commands":    []string{},
			"permissions": map[string]any{},
			"auth":        map[string]any{"token": token},
			"locale":      "en-US",
			"userAgent":   "summit-connector/1.0.0",
		},
	}
	raw, _ := json.Marshal(req)
	return raw, id
}

func buildSubscribe(sessionKey string) []byte {
	raw, _ := json.Marshal(map[string]any{
		"type":   "req",
		"id":     newID(),
		"method": "sessions.messages.subscribe",
		"params": map[string]any{"key": sessionKey},
	})
	return raw
}

func buildChatSend(message, sessionKey, idempotencyKey string) []byte {
	raw, _ := json.Marshal(map[string]any{
		"type":   "req",
		"id":     newID(),
		"method": "chat.send",
		"params": map[string]any{
			"message":        message,
			"idempotencyKey": idempotencyKey,
			"sessionKey":     sessionKey,
		},
	})
	return raw
}

type ocClient struct {
	conn       *websocket.Conn
	writeMu    sync.Mutex
	turnMu     sync.Mutex
	sessionKey string
	subscribed bool
}

func (c *ocClient) write(raw []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteMessage(websocket.TextMessage, raw)
}

func (c *ocClient) close() error { return c.conn.Close() }

// dialOpenClaw performs the trusted-backend handshake and subscribes. See
// docs/openclaw-adapter-research.md §2–3.
func dialOpenClaw(wsURL, token, sessionKey string) (*ocClient, error) {
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("dial gateway: %w", err)
	}
	c := &ocClient{conn: conn, sessionKey: sessionKey}

	// 1. Expect connect.challenge (we don't need the nonce on the backend path).
	if _, _, err := conn.ReadMessage(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("read challenge: %w", err)
	}
	// 2. Send connect, expect hello-ok with operator.write scope.
	connectRaw, id := buildConnect(token)
	if err := c.write(connectRaw); err != nil {
		conn.Close()
		return nil, err
	}
	_, helloRaw, err := conn.ReadMessage()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("read hello-ok: %w", err)
	}
	var hello struct {
		ID      string `json:"id"`
		OK      bool   `json:"ok"`
		Payload struct {
			Type string `json:"type"`
			Auth struct {
				Scopes []string `json:"scopes"`
			} `json:"auth"`
		} `json:"payload"`
	}
	json.Unmarshal(helloRaw, &hello)
	if !hello.OK || hello.ID != id || hello.Payload.Type != "hello-ok" {
		conn.Close()
		return nil, fmt.Errorf("handshake rejected: %s", string(helloRaw))
	}
	if !hasScope(hello.Payload.Auth.Scopes, "operator.write") {
		conn.Close()
		return nil, fmt.Errorf("gateway granted no operator.write scope: %v", hello.Payload.Auth.Scopes)
	}
	// 3. Subscribe.
	if err := c.write(buildSubscribe(sessionKey)); err != nil {
		conn.Close()
		return nil, err
	}
	if _, _, err := conn.ReadMessage(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("read subscribe ack: %w", err)
	}
	c.subscribed = true
	return c, nil
}

// chat sends one message and streams the reply as relay frames. runID doubles
// as the idempotencyKey and correlates the terminal chat event. One turn at a
// time (turnMu); Phase 1 assumes sequential turns per session.
func (c *ocClient) chat(message, runID string) <-chan Frame {
	out := make(chan Frame, 16)
	go func() {
		defer close(out)
		c.turnMu.Lock()
		defer c.turnMu.Unlock()

		if err := c.write(buildChatSend(message, c.sessionKey, runID)); err != nil {
			out <- Frame{T: "error", Message: fmt.Sprintf("chat.send: %v", err)}
			return
		}
		for {
			_, raw, err := c.conn.ReadMessage()
			if err != nil {
				out <- Frame{T: "error", Message: fmt.Sprintf("gateway read: %v", err)}
				return
			}
			f, ok := translateEvent(raw, runID)
			if !ok {
				continue
			}
			out <- f
			if f.T == "done" || f.T == "error" {
				return
			}
		}
	}()
	return out
}

func hasScope(scopes []string, want string) bool {
	for _, s := range scopes {
		if s == want {
			return true
		}
	}
	return false
}

// latestUserMessage returns the content of the last user-role message. OpenClaw
// chat.send takes a single message, not the full array Hermes gets.
func latestUserMessage(msgs []ChatMessage) string {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			return msgs[i].Content
		}
	}
	return ""
}

func handleChatOpenClaw(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, oc *ocClient) {
	for frame := range oc.chat(latestUserMessage(f.Messages), f.ReqID) {
		frame.ReqID = f.ReqID
		if err := writeFrame(conn, writeMu, frame); err != nil {
			return
		}
	}
}
