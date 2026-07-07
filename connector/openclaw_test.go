package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// ocTestServer upgrades to WS and plays the Gateway side of the handshake.
// handle is called with the upgraded conn after hello-ok+subscribe so a test
// can drive turn events.
func ocTestServer(t *testing.T, handle func(*websocket.Conn)) *httptest.Server {
	up := websocket.Upgrader{}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := up.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		defer conn.Close()
		// 1. challenge
		conn.WriteJSON(map[string]any{"type": "event", "event": "connect.challenge",
			"payload": map[string]any{"nonce": "n1", "ts": 1}})
		// 2. read connect, reply hello-ok — with a stray broadcast event first,
		// as observed live (protocol 4 interleaves events with responses).
		_, raw, _ := conn.ReadMessage()
		var req map[string]any
		json.Unmarshal(raw, &req)
		conn.WriteJSON(map[string]any{"type": "event", "event": "health", "payload": map[string]any{"ok": true}})
		conn.WriteJSON(map[string]any{"type": "res", "id": req["id"], "ok": true,
			"payload": map[string]any{"type": "hello-ok", "protocol": 4,
				"auth":   map[string]any{"role": "operator", "scopes": []string{"operator.read", "operator.write", "operator.approvals"}},
				"policy": map[string]any{"tickIntervalMs": 30000}}})
		// 3. read subscribe, ack — again preceded by an unrelated event.
		_, subRaw, _ := conn.ReadMessage()
		var sub map[string]any
		json.Unmarshal(subRaw, &sub)
		conn.WriteJSON(map[string]any{"type": "event", "event": "tick", "payload": map[string]any{"ts": 1}})
		conn.WriteJSON(map[string]any{"type": "res", "id": sub["id"], "ok": true,
			"payload": map[string]any{"subscribed": true, "key": "agent:main:main"}})
		if handle != nil {
			handle(conn)
		}
	}))
}

func TestTranslateEvent(t *testing.T) {
	const runID = "req-1"

	assistant := `{"type":"event","event":"session.message","payload":{
		"sessionKey":"agent:main:main",
		"message":{"role":"assistant","content":[{"type":"text","text":"PONG"}],"stopReason":"end_turn"},
		"messageId":"m2","messageSeq":2}}`
	userEcho := `{"type":"event","event":"session.message","payload":{
		"message":{"role":"user","content":[{"type":"text","text":"hi"}]}}}`
	agentLifecycle := `{"type":"event","event":"agent","payload":{"runId":"req-1","stream":"lifecycle","data":{"phase":"start"}}}`
	chatDone := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"done","errorMessage":null}}`
	// Protocol 4 (Gateway 2026.6.11, live-verified): terminal state is "final",
	// and intermediate "delta" frames carry the assistant message too.
	chatFinal := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"final","message":{"role":"assistant","content":[{"type":"text","text":"pong"}]}}}`
	chatDelta := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"delta","deltaText":"pong","message":{"role":"assistant","content":[{"type":"text","text":"pong"}]}}}`
	chatErr := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"error","errorMessage":"boom"}}`
	otherRun := `{"type":"event","event":"chat","payload":{"runId":"other","state":"final"}}`

	if f, ok := translateEvent([]byte(assistant), runID); !ok || f.T != "chunk" || f.Delta != "PONG" {
		t.Errorf("assistant: got %+v ok=%v", f, ok)
	}
	if _, ok := translateEvent([]byte(userEcho), runID); ok {
		t.Errorf("user echo should be skipped")
	}
	if _, ok := translateEvent([]byte(agentLifecycle), runID); ok {
		t.Errorf("agent lifecycle should be skipped in phase 1")
	}
	if f, ok := translateEvent([]byte(chatDone), runID); !ok || f.T != "done" {
		t.Errorf("chat done: got %+v ok=%v", f, ok)
	}
	if f, ok := translateEvent([]byte(chatFinal), runID); !ok || f.T != "done" {
		t.Errorf("chat final: got %+v ok=%v", f, ok)
	}
	if _, ok := translateEvent([]byte(chatDelta), runID); ok {
		t.Errorf("chat delta should be skipped (session.message carries the reply)")
	}
	if f, ok := translateEvent([]byte(chatErr), runID); !ok || f.T != "error" || f.Message != "boom" {
		t.Errorf("chat error: got %+v ok=%v", f, ok)
	}
	if _, ok := translateEvent([]byte(otherRun), runID); ok {
		t.Errorf("chat for other runId should be skipped")
	}
}

func TestBuildFrames(t *testing.T) {
	connectRaw, id := buildConnect("tok-123")
	if id == "" {
		t.Fatal("connect id must be non-empty")
	}
	var connect map[string]any
	if err := json.Unmarshal(connectRaw, &connect); err != nil {
		t.Fatalf("connect not JSON: %v", err)
	}
	if connect["method"] != "connect" || connect["id"] != id {
		t.Errorf("connect envelope wrong: %v", connect)
	}
	params := connect["params"].(map[string]any)
	client := params["client"].(map[string]any)
	if client["id"] != "gateway-client" || client["mode"] != "backend" {
		t.Errorf("client identity wrong: %v", client)
	}
	if params["role"] != "operator" {
		t.Errorf("role wrong: %v", params["role"])
	}
	// Live-verified: Gateway 2026.6.11 requires protocol 4; 2026.5.6 spoke 3.
	if params["minProtocol"] != float64(3) || params["maxProtocol"] != float64(4) {
		t.Errorf("protocol range wrong: min=%v max=%v", params["minProtocol"], params["maxProtocol"])
	}
	// operator.admin is required to RECEIVE exec.approval.requested pushes
	// (live-verified visibility rule); operator.approvals alone only permits
	// resolving.
	scopes, _ := params["scopes"].([]any)
	found := false
	for _, s := range scopes {
		if s == "operator.admin" {
			found = true
		}
	}
	if !found {
		t.Errorf("connect must request operator.admin for approval pushes: %v", scopes)
	}
	auth := params["auth"].(map[string]any)
	if auth["token"] != "tok-123" {
		t.Errorf("token wrong: %v", auth)
	}

	subRaw, subID := buildSubscribe("main")
	if subID == "" {
		t.Fatal("subscribe id must be non-empty")
	}
	var sub map[string]any
	json.Unmarshal(subRaw, &sub)
	subParams := sub["params"].(map[string]any)
	if sub["method"] != "sessions.messages.subscribe" || subParams["key"] != "main" {
		t.Errorf("subscribe wrong: %v", sub)
	}
	if _, hasSessionKey := subParams["sessionKey"]; hasSessionKey {
		t.Errorf("subscribe must use key, not sessionKey")
	}

	var send map[string]any
	json.Unmarshal(buildChatSend("hello", "main", "idem-1"), &send)
	sendParams := send["params"].(map[string]any)
	if send["method"] != "chat.send" || sendParams["message"] != "hello" ||
		sendParams["idempotencyKey"] != "idem-1" || sendParams["sessionKey"] != "main" {
		t.Errorf("chat.send wrong: %v", send)
	}
}

func TestDialOpenClaw_handshake(t *testing.T) {
	srv := ocTestServer(t, nil)
	defer srv.Close()
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	c, err := dialOpenClaw(wsURL, "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()
	if !c.subscribed {
		t.Errorf("expected subscribed client")
	}
}

func TestOcClient_chatRoundTrip(t *testing.T) {
	srv := ocTestServer(t, func(conn *websocket.Conn) {
		// read chat.send
		_, raw, _ := conn.ReadMessage()
		var send map[string]any
		json.Unmarshal(raw, &send)
		params := send["params"].(map[string]any)
		runID := params["idempotencyKey"].(string)
		// echo user, then assistant, then chat done
		conn.WriteJSON(map[string]any{"type": "event", "event": "session.message",
			"payload": map[string]any{"message": map[string]any{"role": "user",
				"content": []map[string]any{{"type": "text", "text": "hi"}}}}})
		conn.WriteJSON(map[string]any{"type": "event", "event": "session.message",
			"payload": map[string]any{"message": map[string]any{"role": "assistant",
				"content": []map[string]any{{"type": "text", "text": "PONG"}}, "stopReason": "end_turn"}}})
		conn.WriteJSON(map[string]any{"type": "event", "event": "chat",
			"payload": map[string]any{"runId": runID, "state": "final"}})
	})
	defer srv.Close()
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	c, err := dialOpenClaw(wsURL, "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	var got []Frame
	for f := range c.chat("hi", "req-1") {
		got = append(got, f)
	}
	if len(got) != 2 || got[0].T != "chunk" || got[0].Delta != "PONG" || got[1].T != "done" {
		t.Fatalf("unexpected frames: %+v", got)
	}
}

func TestParseApproval(t *testing.T) {
	// Fixture from a live Gateway 2026.6.11 trace.
	push := `{"type":"event","event":"exec.approval.requested","payload":{
		"id":"1c61933c-0f61-4f22-bf58-70aa64a300cc",
		"request":{"command":"rm -rf /tmp/build","systemRunPlan":null,"cwd":"/home/user",
			"allowedDecisions":["allow-once","allow-always","deny"],"agentId":null,"sessionKey":null},
		"createdAtMs":1783380154944,"expiresAtMs":1783381954944}}`
	ap, ok := parseApproval([]byte(push))
	if !ok || ap.ID != "1c61933c-0f61-4f22-bf58-70aa64a300cc" || ap.Command != "rm -rf /tmp/build" {
		t.Errorf("approval push: got %+v ok=%v", ap, ok)
	}
	if _, ok := parseApproval([]byte(`{"type":"event","event":"chat","payload":{"runId":"x","state":"final"}}`)); ok {
		t.Errorf("non-approval event should not parse as approval")
	}
	if _, ok := parseApproval([]byte(`{"type":"event","event":"exec.approval.resolved","payload":{"id":"y"}}`)); ok {
		t.Errorf("resolved event should not parse as a new approval")
	}
}

func TestResolveApprovalFrames(t *testing.T) {
	got := make(chan map[string]any, 2)
	srv := ocTestServer(t, func(conn *websocket.Conn) {
		for i := 0; i < 2; i++ {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var req map[string]any
			json.Unmarshal(raw, &req)
			got <- req
		}
	})
	defer srv.Close()
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	c, err := dialOpenClaw(wsURL, "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	if err := c.resolveApproval("ap-1", "approve"); err != nil {
		t.Fatalf("resolve approve: %v", err)
	}
	if err := c.resolveApproval("ap-2", "deny"); err != nil {
		t.Fatalf("resolve deny: %v", err)
	}

	req := <-got
	params := req["params"].(map[string]any)
	// Live-verified: params are {id, decision} (additionalProperties:false —
	// approvalId would be rejected) and the approve decision is "allow-once".
	if req["method"] != "exec.approval.resolve" || params["id"] != "ap-1" || params["decision"] != "allow-once" {
		t.Errorf("approve frame wrong: %v", req)
	}
	req = <-got
	params = req["params"].(map[string]any)
	if params["id"] != "ap-2" || params["decision"] != "deny" {
		t.Errorf("deny frame wrong: %v", req)
	}
}

func TestApprovalPushDuringChat(t *testing.T) {
	srv := ocTestServer(t, func(conn *websocket.Conn) {
		_, raw, _ := conn.ReadMessage() // chat.send
		var send map[string]any
		json.Unmarshal(raw, &send)
		runID := send["params"].(map[string]any)["idempotencyKey"].(string)
		// Approval push interleaves with the turn (exec blocks the agent).
		conn.WriteJSON(map[string]any{"type": "event", "event": "exec.approval.requested",
			"payload": map[string]any{"id": "ap-9",
				"request": map[string]any{"command": "make deploy"}}})
		conn.WriteJSON(map[string]any{"type": "event", "event": "session.message",
			"payload": map[string]any{"message": map[string]any{"role": "assistant",
				"content": []map[string]any{{"type": "text", "text": "deployed"}}}}})
		conn.WriteJSON(map[string]any{"type": "event", "event": "chat",
			"payload": map[string]any{"runId": runID, "state": "final"}})
	})
	defer srv.Close()
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	c, err := dialOpenClaw(wsURL, "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	approvals := make(chan ocApproval, 1)
	c.setOnApproval(func(ap ocApproval) { approvals <- ap })

	var got []Frame
	for f := range c.chat("deploy", "req-1") {
		got = append(got, f)
	}
	if len(got) != 2 || got[0].T != "chunk" || got[0].Delta != "deployed" || got[1].T != "done" {
		t.Fatalf("turn frames disturbed by approval push: %+v", got)
	}
	select {
	case ap := <-approvals:
		if ap.ID != "ap-9" || ap.Command != "make deploy" {
			t.Errorf("approval callback wrong: %+v", ap)
		}
	default:
		t.Fatal("approval callback never fired")
	}
}

func TestApprovalPushWhileIdle(t *testing.T) {
	srv := ocTestServer(t, func(conn *websocket.Conn) {
		// No turn in flight — the push must still reach the callback.
		conn.WriteJSON(map[string]any{"type": "event", "event": "exec.approval.requested",
			"payload": map[string]any{"id": "ap-idle",
				"request": map[string]any{"command": "ls"}}})
		conn.ReadMessage() // hold the socket open until the client closes
	})
	defer srv.Close()
	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	c, err := dialOpenClaw(wsURL, "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	approvals := make(chan ocApproval, 1)
	c.setOnApproval(func(ap ocApproval) { approvals <- ap })

	select {
	case ap := <-approvals:
		if ap.ID != "ap-idle" || ap.Command != "ls" {
			t.Errorf("idle approval wrong: %+v", ap)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("idle approval push never reached the callback")
	}
}

func TestLatestUserMessage(t *testing.T) {
	msgs := []ChatMessage{
		{Role: "user", Content: "first"},
		{Role: "assistant", Content: "reply"},
		{Role: "user", Content: "second"},
	}
	if got := latestUserMessage(msgs); got != "second" {
		t.Errorf("got %q, want %q", got, "second")
	}
	if got := latestUserMessage(nil); got != "" {
		t.Errorf("empty slice should give empty string, got %q", got)
	}
}

func TestOpenClawTickInterval(t *testing.T) {
	if ocTickIntervalSeconds != 30 {
		t.Errorf("tick interval should be 30s per trace, got %d", ocTickIntervalSeconds)
	}
}
