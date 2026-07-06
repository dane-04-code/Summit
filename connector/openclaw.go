package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
)

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
