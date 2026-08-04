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

// --- Cron: translateCronJob field mapping (fixture-driven — see the schema
// citation on ocCronJob, not yet live-verified against a running Gateway) ---

func TestTranslateCronJob_cronSchedule(t *testing.T) {
	nextMs := int64(1783400000000)
	lastMs := int64(1783300000000)
	job := ocCronJob{
		ID: "job-1", Name: "Morning briefing", Enabled: true,
		Schedule: ocCronSchedule{Kind: "cron", Expr: "0 7 * * *"},
		Payload:  ocCronPayload{Kind: "agentTurn", Message: "Summarize overnight news"},
		Delivery: &ocCronDelivery{Mode: "announce", To: "telegram:123"},
		State:    ocCronState{NextRunAtMs: &nextMs, LastRunAtMs: &lastMs, LastRunStatus: "ok"},
	}
	out := translateCronJob(job)

	if out["id"] != "job-1" || out["name"] != "Morning briefing" || out["enabled"] != true {
		t.Errorf("basic fields: %+v", out)
	}
	sched, _ := out["schedule"].(map[string]any)
	if sched["kind"] != "cron" || sched["expr"] != "0 7 * * *" {
		t.Errorf("schedule: %+v", sched)
	}
	if out["prompt"] != "Summarize overnight news" || out["no_agent"] != false {
		t.Errorf("agentTurn payload: prompt=%v no_agent=%v", out["prompt"], out["no_agent"])
	}
	if out["deliver"] != "telegram:123" {
		t.Errorf("deliver: got %v", out["deliver"])
	}
	if out["last_status"] != "ok" {
		t.Errorf("last_status: got %v", out["last_status"])
	}
	if out["last_run_at"] != time.UnixMilli(lastMs).UTC().Format(time.RFC3339) {
		t.Errorf("last_run_at: got %v", out["last_run_at"])
	}
	if out["next_run_at"] != time.UnixMilli(nextMs).UTC().Format(time.RFC3339) {
		t.Errorf("next_run_at: got %v", out["next_run_at"])
	}
	if _, has := out["state"]; has {
		t.Errorf("enabled+not-running job shouldn't set state, got %v", out["state"])
	}
}

func TestTranslateCronJob_intervalAndCommand(t *testing.T) {
	job := ocCronJob{
		ID: "job-2", Name: "Cleanup", Enabled: false,
		Schedule: ocCronSchedule{Kind: "every", EveryMs: 900000}, // 15m
		Payload:  ocCronPayload{Kind: "command", Argv: []string{"rm", "-rf", "/tmp/x"}},
	}
	out := translateCronJob(job)

	sched, _ := out["schedule"].(map[string]any)
	if sched["kind"] != "interval" || sched["expr"] != "every 15m" {
		t.Errorf("interval schedule: %+v", sched)
	}
	if out["script"] != "rm -rf /tmp/x" || out["no_agent"] != true {
		t.Errorf("command payload: script=%v no_agent=%v", out["script"], out["no_agent"])
	}
	if out["state"] != "paused" {
		t.Errorf("disabled job should report state paused, got %v", out["state"])
	}
	if _, has := out["next_run_at"]; has {
		t.Errorf("paused job shouldn't report a next_run_at")
	}
}

func TestTranslateCronJob_runningAndNoDelivery(t *testing.T) {
	runningMs := int64(1)
	job := ocCronJob{
		ID: "job-3", Name: "Watcher", Enabled: true,
		Schedule: ocCronSchedule{Kind: "at", At: "2026-08-05T00:00:00Z"},
		Payload:  ocCronPayload{Kind: "systemEvent", Text: "heartbeat"},
		State:    ocCronState{RunningAtMs: &runningMs},
	}
	out := translateCronJob(job)

	if out["state"] != "running" {
		t.Errorf("running job: got state=%v", out["state"])
	}
	if out["deliver"] != "local" {
		t.Errorf("no delivery policy should default to local, got %v", out["deliver"])
	}
	if out["prompt"] != "heartbeat" || out["no_agent"] != true {
		t.Errorf("systemEvent payload: prompt=%v no_agent=%v", out["prompt"], out["no_agent"])
	}
}

// --- Cron: ocClient.call() round trip + the four cron methods ---

func ocCronTestServer(t *testing.T, onReq func(method string, params map[string]any) (any, bool, string)) *httptest.Server {
	return ocTestServer(t, func(conn *websocket.Conn) {
		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var req struct {
				ID     string         `json:"id"`
				Method string         `json:"method"`
				Params map[string]any `json:"params"`
			}
			json.Unmarshal(raw, &req)
			payload, ok, errMsg := onReq(req.Method, req.Params)
			res := map[string]any{"type": "res", "id": req.ID, "ok": ok}
			if ok {
				res["payload"] = payload
			} else {
				res["error"] = map[string]any{"message": errMsg}
			}
			conn.WriteJSON(res)
		}
	})
}

func TestCronList_roundTrip(t *testing.T) {
	srv := ocCronTestServer(t, func(method string, params map[string]any) (any, bool, string) {
		if method != "cron.list" {
			t.Errorf("unexpected method %q", method)
		}
		return map[string]any{"jobs": []map[string]any{
			{"id": "j1", "name": "Job One", "enabled": true,
				"schedule": map[string]any{"kind": "cron", "expr": "* * * * *"},
				"payload":  map[string]any{"kind": "agentTurn", "message": "hi"},
				"state":    map[string]any{}},
		}}, true, ""
	})
	defer srv.Close()
	c, err := dialOpenClaw("ws"+strings.TrimPrefix(srv.URL, "http"), "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	body, err := c.cronList()
	if err != nil {
		t.Fatalf("cronList: %v", err)
	}
	var got struct {
		Jobs []map[string]any `json:"jobs"`
	}
	json.Unmarshal(body, &got)
	if len(got.Jobs) != 1 || got.Jobs[0]["id"] != "j1" || got.Jobs[0]["prompt"] != "hi" {
		t.Errorf("translated jobs: %+v", got.Jobs)
	}
}

func TestCronRunAndSetEnabled_paramsAndErrors(t *testing.T) {
	var gotMethod string
	var gotParams map[string]any
	srv := ocCronTestServer(t, func(method string, params map[string]any) (any, bool, string) {
		gotMethod, gotParams = method, params
		if method == "cron.run" {
			return nil, false, "job not found"
		}
		return map[string]any{}, true, ""
	})
	defer srv.Close()
	c, err := dialOpenClaw("ws"+strings.TrimPrefix(srv.URL, "http"), "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	if err := c.cronSetEnabled("job-9", false); err != nil {
		t.Fatalf("cronSetEnabled: %v", err)
	}
	if gotMethod != "cron.update" || gotParams["id"] != "job-9" {
		t.Errorf("cron.update params: method=%q params=%+v", gotMethod, gotParams)
	}
	patch, _ := gotParams["patch"].(map[string]any)
	if patch["enabled"] != false {
		t.Errorf("patch.enabled: got %+v", patch)
	}

	if err := c.cronRun("job-9"); err == nil || !strings.Contains(err.Error(), "job not found") {
		t.Errorf("cronRun should surface the Gateway's rejection, got %v", err)
	}
}

// --- doOpenClawAPI: path routing for the app's job REST calls ---

func TestDoOpenClawAPI_routing(t *testing.T) {
	srv := ocCronTestServer(t, func(method string, params map[string]any) (any, bool, string) {
		switch method {
		case "cron.list":
			return map[string]any{"jobs": []map[string]any{}}, true, ""
		case "cron.get":
			return map[string]any{"id": params["id"], "name": "x", "schedule": map[string]any{"kind": "cron", "expr": "* * * * *"}, "payload": map[string]any{"kind": "agentTurn"}, "state": map[string]any{}}, true, ""
		default:
			return map[string]any{}, true, ""
		}
	})
	defer srv.Close()
	c, err := dialOpenClaw("ws"+strings.TrimPrefix(srv.URL, "http"), "tok", "main")
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.close()

	if status, _ := doOpenClawAPI("GET", "/api/jobs", c); status != http.StatusOK {
		t.Errorf("GET /api/jobs: status %d", status)
	}
	if status, _ := doOpenClawAPI("GET", "/api/jobs/j1", c); status != http.StatusOK {
		t.Errorf("GET /api/jobs/j1: status %d", status)
	}
	if status, _ := doOpenClawAPI("POST", "/api/jobs/j1/pause", c); status != http.StatusOK {
		t.Errorf("POST pause: status %d", status)
	}
	if status, _ := doOpenClawAPI("POST", "/api/jobs/j1/resume", c); status != http.StatusOK {
		t.Errorf("POST resume: status %d", status)
	}
	if status, _ := doOpenClawAPI("POST", "/api/jobs/j1/run", c); status != http.StatusOK {
		t.Errorf("POST run: status %d", status)
	}
	if status, _ := doOpenClawAPI("POST", "/v1/runs/j1/stop", c); status != http.StatusForbidden {
		t.Errorf("Hermes-only stop path should be refused for OpenClaw, got %d", status)
	}
	if status, _ := doOpenClawAPI("DELETE", "/api/jobs/j1", c); status != http.StatusForbidden {
		t.Errorf("unlisted method should be refused, got %d", status)
	}
}
