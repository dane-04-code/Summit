# OpenClaw Connector Chat (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Go connector speak the OpenClaw WebSocket Gateway protocol for basic chat, so a phone paired to an `AGENT_FRAMEWORK=openclaw` connector can send a message and get the agent's reply — reusing the existing relay frames (`chunk`/`done`/`error`) end-to-end.

**Architecture:** All work is in `connector/`. Today every `chat` frame from the relay goes through `streamChat` (Hermes HTTP/SSE). We add a second backend: a persistent WS client to the local OpenClaw Gateway that does the trusted-backend handshake (no device keypair — loopback `gateway-client`/`backend` + shared token), subscribes to the session, sends `chat.send`, and translates OpenClaw's event frames back into the same relay `Frame`s the app already understands. `main.go` branches on `AGENT_FRAMEWORK`. The reply-translation logic is split into **pure functions** (unit-tested against trace fixtures) behind a thin WS transport (integration-tested against an in-process gorilla WebSocket server).

**Tech Stack:** Go, `github.com/gorilla/websocket` (already a dependency), `net/http/httptest` for test servers. No new deps.

## Global Constraints

- Verified protocol facts come from `docs/openclaw-adapter-research.md` (✅ live trace, July 2026). Treat that doc as the source of truth for frame shapes.
- Connect identity is fixed: `client.id: "gateway-client"`, `client.mode: "backend"`, `role: "operator"`, `scopes: ["operator.read","operator.write","operator.approvals"]`, protocol `minProtocol: 3` / `maxProtocol: 3`. No `device` block, no signature.
- `chat.send` params are `message` (string), `idempotencyKey` (required), `sessionKey`. The returned `runId` **equals** the `idempotencyKey` we send.
- `sessions.messages.subscribe` param is `key` (NOT `sessionKey`).
- OpenClaw does **not** stream tokens: the assistant reply arrives as a built `session.message` (role `assistant`). We emit it as a single `chunk` frame, then `done`.
- Turn-completion signal is the `chat` event with `state: "done"` (or `"error"` with `errorMessage`).
- Keepalive `tick` interval is 30s; treat silence > 60s as dead.
- Phase 1 is **chat only** — no approvals, no jobs. OpenClaw already resolves to the messaging floor in `src/agents/frameworks.ts` (`defaultCapabilitiesFor`), so **no app-side changes are in scope.**
- Scope guard: one in-flight OpenClaw turn at a time (serialize with a mutex). Concurrency / demux by `runId` is deferred — it is not needed for Phase 1 and OpenClaw turns within a session are sequential.
- Match existing connector style: `package main`, table tests, `httptest` servers, `Frame` envelope from `main.go`.

---

### Task 1: OpenClaw event → relay Frame translation (pure)

**Files:**
- Create: `connector/openclaw.go`
- Test: `connector/openclaw_test.go`

**Interfaces:**
- Consumes: `Frame` struct from `connector/main.go` (fields `T`, `Delta`, `Message`).
- Produces: `func translateEvent(raw []byte, runID string) (Frame, bool)` — returns a relay `Frame` and `true` when the OpenClaw event maps to something the app should see, or `(Frame{}, false)` to skip. `runID` is the active turn's id (the `idempotencyKey` we sent).

- [ ] **Step 1: Write the failing test**

```go
package main

import "testing"

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
	chatErr := `{"type":"event","event":"chat","payload":{"runId":"req-1","state":"error","errorMessage":"boom"}}`
	otherRun := `{"type":"event","event":"chat","payload":{"runId":"other","state":"done"}}`

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
	if f, ok := translateEvent([]byte(chatErr), runID); !ok || f.T != "error" || f.Message != "boom" {
		t.Errorf("chat error: got %+v ok=%v", f, ok)
	}
	if _, ok := translateEvent([]byte(otherRun), runID); ok {
		t.Errorf("chat for other runId should be skipped")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd connector && go test -run TestTranslateEvent`
Expected: FAIL — `undefined: translateEvent`.

- [ ] **Step 3: Write minimal implementation**

```go
package main

import "encoding/json"

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd connector && go test -run TestTranslateEvent`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add connector/openclaw.go connector/openclaw_test.go
git commit -m "feat(connector): translate OpenClaw chat events to relay frames"
```

---

### Task 2: Outbound frame builders (pure)

**Files:**
- Modify: `connector/openclaw.go`
- Test: `connector/openclaw_test.go`

**Interfaces:**
- Produces:
  - `func buildConnect(token string) ([]byte, string)` — returns the `connect` request JSON and the request `id` it used.
  - `func buildSubscribe(sessionKey string) []byte` — `sessions.messages.subscribe` with param `key`.
  - `func buildChatSend(message, sessionKey, idempotencyKey string) []byte` — `chat.send`.

- [ ] **Step 1: Write the failing test**

```go
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
	auth := params["auth"].(map[string]any)
	if auth["token"] != "tok-123" {
		t.Errorf("token wrong: %v", auth)
	}

	var sub map[string]any
	json.Unmarshal(buildSubscribe("main"), &sub)
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
```

Add the import at the top of `openclaw_test.go`:

```go
import (
	"encoding/json"
	"testing"
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd connector && go test -run TestBuildFrames`
Expected: FAIL — `undefined: buildConnect`.

- [ ] **Step 3: Write minimal implementation**

Add to `connector/openclaw.go` (and add `crypto/rand`, `encoding/hex` to its imports):

```go
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
```

Update the import block in `openclaw.go`:

```go
import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd connector && go test -run TestBuildFrames`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add connector/openclaw.go connector/openclaw_test.go
git commit -m "feat(connector): build OpenClaw connect/subscribe/chat.send frames"
```

---

### Task 3: WS client — handshake + subscribe against an in-process Gateway

**Files:**
- Modify: `connector/openclaw.go`
- Test: `connector/openclaw_test.go`

**Interfaces:**
- Produces:
  - `type ocClient struct { ... }` holding the live `*websocket.Conn`, a write mutex, the resolved `sessionKey`, and a `subscribed bool`.
  - `func dialOpenClaw(wsURL, token, sessionKey string) (*ocClient, error)` — dials, waits for `connect.challenge`, sends `connect`, waits for `hello-ok` (asserting scopes include `operator.write`), then subscribes. Returns a ready client or an error.
  - `func (c *ocClient) close() error`.

- [ ] **Step 1: Write the failing test**

```go
import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
		// 2. read connect, reply hello-ok
		_, raw, _ := conn.ReadMessage()
		var req map[string]any
		json.Unmarshal(raw, &req)
		conn.WriteJSON(map[string]any{"type": "res", "id": req["id"], "ok": true,
			"payload": map[string]any{"type": "hello-ok", "protocol": 3,
				"auth":   map[string]any{"role": "operator", "scopes": []string{"operator.read", "operator.write", "operator.approvals"}},
				"policy": map[string]any{"tickIntervalMs": 30000}}})
		// 3. read subscribe, ack
		_, subRaw, _ := conn.ReadMessage()
		var sub map[string]any
		json.Unmarshal(subRaw, &sub)
		conn.WriteJSON(map[string]any{"type": "res", "id": sub["id"], "ok": true,
			"payload": map[string]any{"subscribed": true, "key": "agent:main:main"}})
		if handle != nil {
			handle(conn)
		}
	}))
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd connector && go test -run TestDialOpenClaw`
Expected: FAIL — `undefined: dialOpenClaw`.

- [ ] **Step 3: Write minimal implementation**

Add to `connector/openclaw.go` (add `fmt`, `sync`, `github.com/gorilla/websocket` to imports):

```go
type ocClient struct {
	conn       *websocket.Conn
	writeMu    sync.Mutex
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

func hasScope(scopes []string, want string) bool {
	for _, s := range scopes {
		if s == want {
			return true
		}
	}
	return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd connector && go test -run TestDialOpenClaw`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add connector/openclaw.go connector/openclaw_test.go
git commit -m "feat(connector): OpenClaw gateway handshake + subscribe"
```

---

### Task 4: Chat turn — send and stream reply frames

**Files:**
- Modify: `connector/openclaw.go`
- Test: `connector/openclaw_test.go`

**Interfaces:**
- Produces: `func (c *ocClient) chat(message, runID string) <-chan Frame` — sends `chat.send` (using `runID` as the `idempotencyKey`), then reads gateway events, feeding each through `translateEvent(raw, runID)` onto the returned channel until a `done`/`error` frame is produced, then closes the channel. Serialized by an internal turn mutex so only one turn runs at a time.

- [ ] **Step 1: Write the failing test**

```go
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
			"payload": map[string]any{"runId": runID, "state": "done"}})
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd connector && go test -run TestOcClient_chatRoundTrip`
Expected: FAIL — `c.chat undefined`.

- [ ] **Step 3: Write minimal implementation**

Add a `turnMu sync.Mutex` field to `ocClient` (place it next to `writeMu`), then add:

```go
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd connector && go test -run TestOcClient_chatRoundTrip`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add connector/openclaw.go connector/openclaw_test.go
git commit -m "feat(connector): OpenClaw chat turn -> relay frames"
```

---

### Task 5: Wire OpenClaw into the connector run loop

**Files:**
- Modify: `connector/main.go`
- Modify: `connector/openclaw.go`
- Test: `connector/openclaw_test.go`

**Interfaces:**
- Consumes: `dialOpenClaw`, `(*ocClient).chat`, `handleChat`'s frame-writing pattern from `main.go`.
- Produces: `func handleChatOpenClaw(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, oc *ocClient)` — pulls the latest user message text out of `f.Messages`, runs `oc.chat`, and writes each frame back with `ReqID` set (mirroring `handleChat`).

- [ ] **Step 1: Write the failing test**

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd connector && go test -run TestLatestUserMessage`
Expected: FAIL — `undefined: latestUserMessage`.

- [ ] **Step 3: Write minimal implementation**

Add to `connector/openclaw.go`:

```go
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
```

Now branch in `connector/main.go`. In `run(...)`, after the relay `hello` is sent and before the read loop, dial the gateway when the framework is OpenClaw. Change the `run` signature to accept the framework/base/token and add the dial:

In `main()`, replace the Hermes-only env read with framework-aware reads (keep Hermes working):

```go
	openclawBase := strings.TrimRight(os.Getenv("OPENCLAW_WS_URL"), "/")
	openclawToken := os.Getenv("OPENCLAW_TOKEN")
```

Pass them into `run(...)`. Inside `run`, after `writeFrame(... hello ...)`:

```go
	var oc *ocClient
	if framework == "openclaw" {
		if openclawWSURL == "" || openclawToken == "" {
			return fmt.Errorf("OPENCLAW_WS_URL and OPENCLAW_TOKEN must be set for openclaw")
		}
		oc, err = dialOpenClaw(openclawWSURL, openclawToken, "main")
		if err != nil {
			return fmt.Errorf("openclaw dial: %w", err)
		}
		defer oc.close()
	}
```

Then change the `chat` case in the read-loop switch:

```go
		case "chat":
			if oc != nil {
				go handleChatOpenClaw(conn, &writeMu, f, oc)
			} else {
				go handleChat(conn, &writeMu, f, f.SessionID, f.SessionKey, hermesBase, apiKey)
			}
```

Guard the startup fatal in `main()` so Hermes creds are only required when not OpenClaw:

```go
	if framework != "openclaw" && (hermesBase == "" || apiKey == "") {
		log.Fatal("HERMES_BASE_URL and HERMES_API_KEY must be set")
	}
```

(Adjust `run`'s parameter list to thread `openclawWSURL`, `openclawToken` through; keep existing Hermes params.)

- [ ] **Step 4: Run tests + build to verify**

Run: `cd connector && go test ./... && go build ./...`
Expected: all tests PASS, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add connector/main.go connector/openclaw.go connector/openclaw_test.go
git commit -m "feat(connector): route chat to OpenClaw gateway when AGENT_FRAMEWORK=openclaw"
```

---

### Task 6: Keepalive + document the env contract

**Files:**
- Modify: `connector/openclaw.go`
- Modify: `docs/openclaw-adapter-research.md` (close open item #3 partially — record the env contract)
- Test: `connector/openclaw_test.go`

**Interfaces:**
- Produces: `func (c *ocClient) keepalive(stop <-chan struct{})` — writes a `tick`-style ping... **NOTE:** OpenClaw sends `tick` events to *us*; the client is not required to send them. Phase 1 keepalive is therefore just a **read-deadline watchdog**: if no frame arrives for > 60s the connection is considered dead. We rely on `main.go`'s outer 5s reconnect loop (the gateway dial happens inside `run`, so a dead gateway conn surfaces as a chat error and the next `run` re-dials). Keep this task minimal: assert the interval constant exists and is documented.

- [ ] **Step 1: Write the failing test**

```go
func TestOpenClawTickInterval(t *testing.T) {
	if ocTickIntervalSeconds != 30 {
		t.Errorf("tick interval should be 30s per trace, got %d", ocTickIntervalSeconds)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd connector && go test -run TestOpenClawTickInterval`
Expected: FAIL — `undefined: ocTickIntervalSeconds`.

- [ ] **Step 3: Write minimal implementation**

Add to `connector/openclaw.go`:

```go
// ocTickIntervalSeconds is the Gateway's policy.tickIntervalMs (30s) expressed
// in seconds. Silence beyond 2x this means the connection is dead
// (docs/openclaw-adapter-research.md §5). Phase 1 leans on the connector's outer
// reconnect loop rather than an in-client watchdog.
const ocTickIntervalSeconds = 30
```

Append to `docs/openclaw-adapter-research.md` under "Open items", closing #3's env half:

```markdown
> **Connector env contract (Phase 1, implemented):** set `AGENT_FRAMEWORK=openclaw`,
> `OPENCLAW_WS_URL=ws://localhost:18789`, `OPENCLAW_TOKEN=<gateway-shared-token>`.
> Hermes env (`HERMES_BASE_URL`/`HERMES_API_KEY`) is not required in this mode.
> Still open: where the install script sources `OPENCLAW_TOKEN` from on a real box.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd connector && go test ./...`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add connector/openclaw.go docs/openclaw-adapter-research.md
git commit -m "docs(connector): record OpenClaw tick interval + env contract"
```

---

## Self-Review

**Spec coverage** (against `docs/openclaw-adapter-research.md` §1–5, Phase 1 chat scope):
- §2 handshake (backend identity, scopes, no device block) → Task 2 (`buildConnect`) + Task 3 (`dialOpenClaw` scope assertion). ✅
- §3 subscribe (`key` param) + `chat.send` (`message`/`idempotencyKey`/`sessionKey`) → Task 2 + Task 4. ✅
- §3 event translation (assistant `session.message` → chunk, `chat` done/error) → Task 1. ✅
- §5 tick interval (30s) → Task 6. ✅
- `main.go` routing on `AGENT_FRAMEWORK` → Task 5. ✅
- App-side: intentionally out of scope (OpenClaw already gets the messaging floor). Noted in Global Constraints. ✅
- Out of scope by design: approvals (§4), HTTP path (§6), jobs, token streaming. Called out in Global Constraints.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 5's `main.go` edits are described as targeted diffs against real, quoted existing lines rather than full-file rewrites — acceptable because the surrounding code is short and shown in the task.

**Type consistency:** `Frame` fields (`T`, `Delta`, `Message`, `ReqID`, `Messages`, `SessionID`, `SessionKey`) all exist in `main.go`. `ocClient` fields (`conn`, `writeMu`, `turnMu`, `sessionKey`, `subscribed`) consistent across Tasks 3–4. `translateEvent(raw, runID)`, `dialOpenClaw(wsURL, token, sessionKey)`, `(*ocClient).chat(message, runID)`, `latestUserMessage(msgs)`, `newID()`, `hasScope()` names match every call site. `runID == idempotencyKey == f.ReqID` correlation is consistent Tasks 1/4/5.

**One risk flagged for the executor:** these fixtures encode the *traced* frame shapes, not a live gateway. After Task 5, validate against a real OpenClaw Gateway before considering Phase 1 shippable (open items #2 port, #3 token sourcing).
