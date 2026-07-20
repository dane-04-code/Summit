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
		// Protocol 3 says "done"; protocol 4 (Gateway 2026.6.11, live-verified)
		// says "final". Intermediate "delta" states are skipped — the assistant
		// session.message already carries the full reply.
		case "done", "final":
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
			// The July 2026 trace was protocol 3 (Gateway 2026.5.6); Gateway
			// 2026.6.11 requires 4. Offer the range and let the server pick.
			"minProtocol": 3,
			"maxProtocol": 4,
			"client": map[string]any{
				"id": "gateway-client", "version": "1.0.0", "platform": "connector", "mode": "backend",
			},
			"role": "operator",
			// operator.admin is what makes the Gateway push
			// exec.approval.requested to this client (live-verified);
			// operator.approvals alone only allows resolving.
			"scopes":      []string{"operator.read", "operator.write", "operator.approvals", "operator.admin"},
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

func buildSubscribe(sessionKey string) ([]byte, string) {
	id := newID()
	raw, _ := json.Marshal(map[string]any{
		"type":   "req",
		"id":     id,
		"method": "sessions.messages.subscribe",
		"params": map[string]any{"key": sessionKey},
	})
	return raw, id
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

// ocApproval is one pushed exec.approval.requested, reduced to what the app's
// approval card needs.
type ocApproval struct {
	ID      string
	Command string
}

// parseApproval extracts an exec approval push. Payload shape (live-verified,
// Gateway 2026.6.11): { id, request: { command, ... }, createdAtMs, expiresAtMs }.
func parseApproval(raw []byte) (ocApproval, bool) {
	var ev struct {
		Event   string `json:"event"`
		Payload struct {
			ID      string `json:"id"`
			Request struct {
				Command string `json:"command"`
			} `json:"request"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(raw, &ev); err != nil {
		return ocApproval{}, false
	}
	if ev.Event != "exec.approval.requested" || ev.Payload.ID == "" {
		return ocApproval{}, false
	}
	return ocApproval{ID: ev.Payload.ID, Command: ev.Payload.Request.Command}, true
}

type ocClient struct {
	conn       *websocket.Conn
	writeMu    sync.Mutex
	turnMu     sync.Mutex
	sessionKey string
	subscribed bool

	// One reader goroutine (readLoop) owns the socket after dial and demuxes:
	// turn events go to the active turn channel, approval pushes to onApproval.
	mu         sync.Mutex
	turnCh     chan Frame
	turnRunID  string
	onApproval func(ocApproval)
	pending    []ocApproval
	closed     bool
	done       chan struct{}
	closeOnce  sync.Once
}

func (c *ocClient) write(raw []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteMessage(websocket.TextMessage, raw)
}

func (c *ocClient) close() error {
	c.closeOnce.Do(func() { close(c.done) })
	return c.conn.Close()
}

// setOnApproval registers the handler for pushed exec approvals. Called from
// the read loop; keep it non-blocking.
func (c *ocClient) setOnApproval(fn func(ocApproval)) {
	c.mu.Lock()
	c.onApproval = fn
	pending := append([]ocApproval(nil), c.pending...)
	c.pending = nil
	c.mu.Unlock()
	for _, ap := range pending {
		fn(ap)
	}
}

// resolveApproval answers a pushed approval. The app speaks approve/deny; the
// Gateway's enum is allow-once/allow-always/deny (live-verified) — approve maps
// to allow-once so each command is gated individually.
func (c *ocClient) resolveApproval(approvalID, decision string) error {
	gw := "deny"
	if decision == "approve" {
		gw = "allow-once"
	}
	raw, _ := json.Marshal(map[string]any{
		"type":   "req",
		"id":     newID(),
		"method": "exec.approval.resolve",
		"params": map[string]any{"id": approvalID, "decision": gw},
	})
	return c.write(raw)
}

// readLoop is the single socket reader: approval pushes fire onApproval, turn
// events feed the active chat channel, everything else is dropped. On read
// error it wakes any in-flight chat via the done channel.
func (c *ocClient) readLoop() {
	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			c.mu.Lock()
			c.closed = true
			c.mu.Unlock()
			c.closeOnce.Do(func() { close(c.done) })
			return
		}
		if ap, ok := parseApproval(raw); ok {
			c.mu.Lock()
			cb := c.onApproval
			if cb == nil {
				c.pending = append(c.pending, ap)
			}
			c.mu.Unlock()
			if cb != nil {
				cb(ap)
			}
			continue
		}
		c.mu.Lock()
		ch, runID := c.turnCh, c.turnRunID
		c.mu.Unlock()
		if ch == nil {
			continue
		}
		f, ok := translateEvent(raw, runID)
		if !ok {
			continue
		}
		select {
		case ch <- f:
		case <-c.done:
			return
		}
	}
}

// dialOpenClaw performs the trusted-backend handshake and subscribes. See
// docs/openclaw-adapter-research.md §2–3.
func dialOpenClaw(wsURL, token, sessionKey string) (*ocClient, error) {
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("dial gateway: %w", err)
	}
	c := &ocClient{conn: conn, sessionKey: sessionKey, done: make(chan struct{})}

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
	helloRaw, err := readRes(conn, id)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("read hello-ok: %w", err)
	}
	var hello struct {
		OK      bool `json:"ok"`
		Payload struct {
			Type string `json:"type"`
			Auth struct {
				Scopes []string `json:"scopes"`
			} `json:"auth"`
		} `json:"payload"`
	}
	json.Unmarshal(helloRaw, &hello)
	if !hello.OK || hello.Payload.Type != "hello-ok" {
		conn.Close()
		return nil, fmt.Errorf("handshake rejected: %s", string(helloRaw))
	}
	if !hasScope(hello.Payload.Auth.Scopes, "operator.write") {
		conn.Close()
		return nil, fmt.Errorf("gateway granted no operator.write scope: %v", hello.Payload.Auth.Scopes)
	}
	// 3. Subscribe.
	subRaw, subID := buildSubscribe(sessionKey)
	if err := c.write(subRaw); err != nil {
		conn.Close()
		return nil, err
	}
	ackRaw, err := readRes(conn, subID)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("read subscribe ack: %w", err)
	}
	var ack struct {
		OK bool `json:"ok"`
	}
	json.Unmarshal(ackRaw, &ack)
	if !ack.OK {
		conn.Close()
		return nil, fmt.Errorf("subscribe rejected: %s", string(ackRaw))
	}
	c.subscribed = true
	go c.readLoop()
	return c, nil
}

// readRes reads frames until the response with the given request id arrives,
// skipping interleaved broadcast events (health, tick, …) — live Gateways send
// those between our request and its response.
func readRes(conn *websocket.Conn, id string) ([]byte, error) {
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return nil, err
		}
		var env struct {
			Type string `json:"type"`
			ID   string `json:"id"`
		}
		json.Unmarshal(raw, &env)
		if env.Type == "res" && env.ID == id {
			return raw, nil
		}
	}
}

// chat sends one message and streams the reply as relay frames. runID doubles
// as the idempotencyKey and correlates the terminal chat event. One turn at a
// time (turnMu); sequential turns per session. Turn events are delivered by
// readLoop through the registered turn channel.
func (c *ocClient) chat(message, runID string) <-chan Frame {
	out := make(chan Frame, 16)
	go func() {
		defer close(out)
		c.turnMu.Lock()
		defer c.turnMu.Unlock()

		turn := make(chan Frame, 16)
		c.mu.Lock()
		if c.closed {
			c.mu.Unlock()
			out <- Frame{T: "error", Message: "gateway connection lost"}
			return
		}
		c.turnCh, c.turnRunID = turn, runID
		c.mu.Unlock()
		defer func() {
			c.mu.Lock()
			if c.turnCh == turn {
				c.turnCh = nil
			}
			c.mu.Unlock()
		}()

		if err := c.write(buildChatSend(message, c.sessionKey, runID)); err != nil {
			out <- Frame{T: "error", Message: fmt.Sprintf("chat.send: %v", err)}
			return
		}
		for {
			select {
			case f := <-turn:
				out <- f
				if f.T == "done" || f.T == "error" {
					return
				}
			case <-c.done:
				// The gateway can close immediately after its terminal event. The
				// read loop writes that event to turn before it observes the close,
				// so drain it before reporting a connection error.
				for {
					select {
					case f := <-turn:
						out <- f
						if f.T == "done" || f.T == "error" {
							return
						}
					default:
						out <- Frame{T: "error", Message: "gateway connection lost"}
						return
					}
				}
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

func handleChatOpenClaw(conn *websocket.Conn, writeMu *sync.Mutex, f Frame, oc *ocClient, outbox *replyOutbox) {
	forwardChatFrames(conn, writeMu, f, oc.chat(latestUserMessage(f.Messages), f.ReqID), outbox)
}
