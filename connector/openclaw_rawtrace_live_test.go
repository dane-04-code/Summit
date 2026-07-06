//go:build live

package main

import (
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// TestLiveRawTrace sends one chat.send and dumps every raw frame for 45s.
func TestLiveRawTrace(t *testing.T) {
	url, token := liveEnv(t)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	conn.ReadMessage() // challenge
	connectRaw, _ := buildConnect(token)
	conn.WriteMessage(websocket.TextMessage, connectRaw)
	conn.ReadMessage() // hello-ok
	subRaw, _ := buildSubscribe("main")
	conn.WriteMessage(websocket.TextMessage, subRaw)
	_, sub, _ := conn.ReadMessage()
	t.Logf("subscribe ack: %s", sub)
	runID := newID()
	t.Logf("runID(idempotencyKey): %s", runID)
	conn.WriteMessage(websocket.TextMessage, buildChatSend("Reply with exactly the word: pong", "main", runID))
	deadline := time.Now().Add(45 * time.Second)
	conn.SetReadDeadline(deadline)
	for time.Now().Before(deadline) {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			t.Logf("read end: %v", err)
			return
		}
		if len(raw) > 2000 {
			raw = raw[:2000]
		}
		t.Logf("frame: %s", raw)
	}
}
