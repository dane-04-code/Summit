//go:build live

package main

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestLiveAdminScope(t *testing.T) {
	url, token := liveEnv(t)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	conn.ReadMessage()
	req := map[string]any{
		"type": "req", "id": newID(), "method": "connect",
		"params": map[string]any{
			"minProtocol": 3, "maxProtocol": 4,
			"client":      map[string]any{"id": "gateway-client", "version": "1.0.0", "platform": "connector", "mode": "backend"},
			"role":        "operator",
			"scopes":      []string{"operator.read", "operator.write", "operator.approvals", "operator.admin"},
			"caps":        []string{}, "commands": []string{}, "permissions": map[string]any{},
			"auth":        map[string]any{"token": token},
			"locale":      "en-US", "userAgent": "summit-connector/1.0.0",
		},
	}
	raw, _ := json.Marshal(req)
	conn.WriteMessage(websocket.TextMessage, raw)
	_, hello, _ := conn.ReadMessage()
	var h struct {
		OK      bool `json:"ok"`
		Payload struct {
			Auth struct {
				Scopes []string `json:"scopes"`
			} `json:"auth"`
		} `json:"payload"`
	}
	json.Unmarshal(hello, &h)
	t.Logf("ok=%v scopes=%v", h.OK, h.Payload.Auth.Scopes)
	if !h.OK || !hasScope(h.Payload.Auth.Scopes, "operator.admin") {
		t.Fatalf("operator.admin not granted: %s", hello)
	}

	// now file a request from a second conn and see if we receive the push
	requester := liveConnect(t)
	defer requester.Close()
	reqFrame, _ := json.Marshal(map[string]any{
		"type": "req", "id": newID(), "method": "exec.approval.request",
		"params": map[string]any{"command": "rm -rf /tmp/build", "cwd": "/home/user"},
	})
	requester.WriteMessage(websocket.TextMessage, reqFrame)

	deadline := time.Now().Add(20 * time.Second)
	conn.SetReadDeadline(deadline)
	for time.Now().Before(deadline) {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("no approval push before timeout: %v", err)
		}
		var env struct {
			Event string `json:"event"`
		}
		json.Unmarshal(raw, &env)
		if env.Event == "exec.approval.requested" {
			t.Logf("PUSH RECEIVED: %s", raw)
			return
		}
	}
	t.Fatal("no push")
}
