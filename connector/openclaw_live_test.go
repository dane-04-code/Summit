//go:build live

package main

// Live validation harness for the OpenClaw Gateway integration (Task A of
// docs/superpowers/plans/2026-07-06-openclaw-next-steps-handoff.md).
//
// Not run in CI. Requires a real Gateway, e.g.:
//
//	openclaw gateway --dev --allow-unconfigured --token summit-test-token-123
//	go test -tags live -run TestLive -v \
//	  (env OPENCLAW_WS_URL / OPENCLAW_TOKEN override the localhost defaults)

import (
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func liveEnv(t *testing.T) (url, token string) {
	url = os.Getenv("OPENCLAW_WS_URL")
	if url == "" {
		url = "ws://localhost:18789"
	}
	token = os.Getenv("OPENCLAW_TOKEN")
	if token == "" {
		token = "summit-test-token-123"
	}
	return url, token
}

// TestLiveHandshakeShapes performs the raw handshake and logs the hello-ok
// payload so the traced shapes (scopes, tickIntervalMs, methods) can be
// eyeballed against docs/openclaw-adapter-research.md.
func TestLiveHandshakeShapes(t *testing.T) {
	url, token := liveEnv(t)
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	_, challenge, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read challenge: %v", err)
	}
	t.Logf("challenge: %s", challenge)

	connectRaw, _ := buildConnect(token)
	if err := conn.WriteMessage(websocket.TextMessage, connectRaw); err != nil {
		t.Fatalf("write connect: %v", err)
	}
	_, hello, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("read hello-ok: %v", err)
	}
	t.Logf("hello-ok: %s", hello)

	var h struct {
		OK      bool `json:"ok"`
		Payload struct {
			Auth struct {
				Scopes []string `json:"scopes"`
			} `json:"auth"`
			Policy struct {
				TickIntervalMs int `json:"tickIntervalMs"`
			} `json:"policy"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(hello, &h); err != nil {
		t.Fatalf("unmarshal hello-ok: %v", err)
	}
	if !h.OK {
		t.Fatalf("handshake rejected: %s", hello)
	}
	if !hasScope(h.Payload.Auth.Scopes, "operator.write") {
		t.Errorf("missing operator.write scope: %v", h.Payload.Auth.Scopes)
	}
	if !hasScope(h.Payload.Auth.Scopes, "operator.approvals") {
		t.Errorf("missing operator.approvals scope (Phase 2 needs it): %v", h.Payload.Auth.Scopes)
	}
	if h.Payload.Policy.TickIntervalMs != ocTickIntervalSeconds*1000 {
		t.Errorf("tickIntervalMs = %d, code assumes %d", h.Payload.Policy.TickIntervalMs, ocTickIntervalSeconds*1000)
	}
}

// TestLiveChatRoundTrip drives the production dialOpenClaw + chat path and
// requires a real assistant reply followed by a done frame.
func TestLiveChatRoundTrip(t *testing.T) {
	url, token := liveEnv(t)
	c, err := dialOpenClaw(url, token, "main")
	if err != nil {
		t.Fatalf("dialOpenClaw: %v", err)
	}
	defer c.close()

	frames := c.chat("Reply with exactly the word: pong", newID())
	var got []Frame
	timeout := time.After(120 * time.Second)
	for {
		select {
		case f, ok := <-frames:
			if !ok {
				goto done
			}
			t.Logf("frame: %+v", f)
			got = append(got, f)
		case <-timeout:
			t.Fatalf("timed out waiting for turn to finish; frames so far: %+v", got)
		}
	}
done:
	if len(got) == 0 {
		t.Fatal("no frames received")
	}
	last := got[len(got)-1]
	if last.T != "done" {
		t.Fatalf("turn did not end with done: %+v", got)
	}
	chunk := false
	for _, f := range got {
		if f.T == "chunk" && f.Delta != "" {
			chunk = true
		}
	}
	if !chunk {
		t.Fatalf("no assistant chunk received: %+v", got)
	}
}
