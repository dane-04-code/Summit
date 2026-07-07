//go:build live

package main

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func liveConnect(t *testing.T) *websocket.Conn {
	url, token := liveEnv(t)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	conn.ReadMessage() // challenge
	connectRaw, _ := buildConnect(token)
	conn.WriteMessage(websocket.TextMessage, connectRaw)
	conn.ReadMessage() // hello-ok
	return conn
}

// TestLiveApprovalViaClient drives the production ocClient: a second raw conn
// files an exec approval; the client's push callback fires; resolveApproval
// answers it; the requester's pending res completes with allow-once.
func TestLiveApprovalViaClient(t *testing.T) {
	url, token := liveEnv(t)
	c, err := dialOpenClaw(url, token, "main")
	if err != nil {
		t.Fatalf("dialOpenClaw: %v", err)
	}
	defer c.close()

	pushes := make(chan ocApproval, 1)
	c.setOnApproval(func(ap ocApproval) { pushes <- ap })

	requester := liveConnect(t)
	defer requester.Close()
	reqFrame, _ := json.Marshal(map[string]any{
		"type": "req", "id": newID(), "method": "exec.approval.request",
		"params": map[string]any{"command": "make deploy", "cwd": "/srv/app"},
	})
	requester.WriteMessage(websocket.TextMessage, reqFrame)

	var ap ocApproval
	select {
	case ap = <-pushes:
		t.Logf("push received: %+v", ap)
	case <-time.After(15 * time.Second):
		t.Fatal("production client never saw the approval push")
	}
	if ap.Command != "make deploy" {
		t.Fatalf("wrong command: %+v", ap)
	}

	if err := c.resolveApproval(ap.ID, "approve"); err != nil {
		t.Fatalf("resolveApproval: %v", err)
	}

	// The requester's exec.approval.request res settles once resolved.
	requester.SetReadDeadline(time.Now().Add(10 * time.Second))
	for {
		_, raw, err := requester.ReadMessage()
		if err != nil {
			t.Fatalf("requester res never arrived: %v", err)
		}
		var env struct {
			Type    string `json:"type"`
			Payload struct {
				Decision string `json:"decision"`
			} `json:"payload"`
		}
		json.Unmarshal(raw, &env)
		if env.Type == "res" {
			t.Logf("requester res: %s", raw)
			if env.Payload.Decision != "allow-once" {
				t.Fatalf("decision not allow-once: %s", raw)
			}
			return
		}
	}
}
