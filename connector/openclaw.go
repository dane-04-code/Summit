package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

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
	// turn events go to the active turn channel, approval pushes to onApproval,
	// and any "res" whose id matches a pendingCalls entry goes to that call's
	// waiter (cron.*, or any future synchronous req/res method).
	mu           sync.Mutex
	turnCh       chan Frame
	turnRunID    string
	onApproval   func(ocApproval)
	pending      []ocApproval
	pendingCalls map[string]chan []byte
	closed       bool
	done         chan struct{}
	closeOnce    sync.Once
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

// ocCallTimeout bounds a synchronous call() — generous, since cron.list on a
// large job set is the slowest of these, but must not hang the app forever if
// the Gateway never answers.
const ocCallTimeout = 15 * time.Second

// call sends a req and blocks for its matching res, demuxed by readLoop via
// pendingCalls. Returns the res's payload on ok:true, or an error describing
// the Gateway's error/errorMessage on ok:false.
func (c *ocClient) call(method string, params any) (json.RawMessage, error) {
	id := newID()
	ch := make(chan []byte, 1)
	c.mu.Lock()
	if c.pendingCalls == nil {
		c.pendingCalls = map[string]chan []byte{}
	}
	c.pendingCalls[id] = ch
	c.mu.Unlock()
	defer func() {
		c.mu.Lock()
		delete(c.pendingCalls, id)
		c.mu.Unlock()
	}()

	raw, _ := json.Marshal(map[string]any{
		"type": "req", "id": id, "method": method, "params": params,
	})
	if err := c.write(raw); err != nil {
		return nil, fmt.Errorf("%s: %w", method, err)
	}

	select {
	case resRaw := <-ch:
		var res struct {
			OK      bool            `json:"ok"`
			Payload json.RawMessage `json:"payload"`
			Error   struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(resRaw, &res); err != nil {
			return nil, fmt.Errorf("%s: bad response: %w", method, err)
		}
		if !res.OK {
			msg := res.Error.Message
			if msg == "" {
				msg = "request rejected"
			}
			return nil, fmt.Errorf("%s: %s", method, msg)
		}
		return res.Payload, nil
	case <-c.done:
		return nil, fmt.Errorf("%s: gateway connection lost", method)
	case <-time.After(ocCallTimeout):
		return nil, fmt.Errorf("%s: timed out", method)
	}
}

// ocCronSchedule, ocCronPayload, ocCronDelivery, ocCronState, ocCronJob mirror
// the Gateway's CronJobSchema (compiled source of the installed openclaw npm
// package, 2026.6.11 — server-methods/cron.ts + schema.ts). Not yet
// live-verified against a running Gateway; fixture-driven like Phase 1 was
// before its live pass.
type ocCronSchedule struct {
	Kind    string `json:"kind"`
	At      string `json:"at,omitempty"`
	EveryMs int64  `json:"everyMs,omitempty"`
	Expr    string `json:"expr,omitempty"`
}

type ocCronPayload struct {
	Kind    string   `json:"kind"`
	Text    string   `json:"text,omitempty"`
	Message string   `json:"message,omitempty"`
	Argv    []string `json:"argv,omitempty"`
}

type ocCronDelivery struct {
	Mode string `json:"mode,omitempty"`
	To   string `json:"to,omitempty"`
}

type ocCronState struct {
	NextRunAtMs   *int64 `json:"nextRunAtMs,omitempty"`
	RunningAtMs   *int64 `json:"runningAtMs,omitempty"`
	LastRunAtMs   *int64 `json:"lastRunAtMs,omitempty"`
	LastRunStatus string `json:"lastRunStatus,omitempty"`
}

type ocCronJob struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Enabled  bool            `json:"enabled"`
	Schedule ocCronSchedule  `json:"schedule"`
	Payload  ocCronPayload   `json:"payload"`
	Delivery *ocCronDelivery `json:"delivery,omitempty"`
	State    ocCronState     `json:"state"`
}

// msToRFC3339 renders a Gateway epoch-ms field the way jobs.ts's str() field
// readers expect: an ISO string, or "" (omitted) when unset.
func msToRFC3339(ms *int64) string {
	if ms == nil {
		return ""
	}
	return time.UnixMilli(*ms).UTC().Format(time.RFC3339)
}

// translateCronJob maps one Gateway cron job record onto the field names
// src/agents/adapters/jobs.ts already knows how to read from Hermes's
// GET /api/jobs (a deliberately lenient normalizer — snake_case, several
// aliases per field) so no app-side change is needed for either framework.
func translateCronJob(job ocCronJob) map[string]any {
	schedule := map[string]any{}
	switch job.Schedule.Kind {
	case "every":
		expr := fmt.Sprintf("every %dm", job.Schedule.EveryMs/60000)
		schedule = map[string]any{"kind": "interval", "expr": expr, "display": expr}
	case "at":
		schedule = map[string]any{"kind": "cron", "expr": job.Schedule.At, "display": "At " + job.Schedule.At}
	default: // "cron"
		schedule = map[string]any{"kind": "cron", "expr": job.Schedule.Expr, "display": job.Schedule.Expr}
	}

	out := map[string]any{
		"id":       job.ID,
		"name":     job.Name,
		"enabled":  job.Enabled,
		"schedule": schedule,
		"skills":   []string{},
	}
	if job.State.RunningAtMs != nil {
		out["state"] = "running"
	} else if !job.Enabled {
		out["state"] = "paused"
	}
	switch job.State.LastRunStatus {
	case "ok", "error":
		out["last_status"] = job.State.LastRunStatus
	}
	if at := msToRFC3339(job.State.LastRunAtMs); at != "" {
		out["last_run_at"] = at
	}
	if at := msToRFC3339(job.State.NextRunAtMs); at != "" && job.Enabled {
		out["next_run_at"] = at
	}

	switch {
	case job.Delivery == nil || job.Delivery.Mode == "" || job.Delivery.Mode == "none":
		out["deliver"] = "local"
	case job.Delivery.Mode == "announce" && job.Delivery.To != "":
		out["deliver"] = job.Delivery.To
	case job.Delivery.Mode == "announce":
		out["deliver"] = "origin"
	default:
		out["deliver"] = job.Delivery.Mode
	}

	switch job.Payload.Kind {
	case "agentTurn":
		out["prompt"] = job.Payload.Message
		out["no_agent"] = false
	case "systemEvent":
		out["prompt"] = job.Payload.Text
		out["no_agent"] = true
	case "command":
		out["script"] = strings.Join(job.Payload.Argv, " ")
		out["no_agent"] = true
	}
	return out
}

// cronList fetches every job with full detail (the Gateway's cron.list
// defaults to full records; compact:true would drop schedule/delivery/payload,
// which the app's Cron UI needs) and returns Hermes-shaped {"jobs": [...]}.
func (c *ocClient) cronList() ([]byte, error) {
	payload, err := c.call("cron.list", map[string]any{})
	if err != nil {
		return nil, err
	}
	var page struct {
		Jobs []ocCronJob `json:"jobs"`
	}
	if err := json.Unmarshal(payload, &page); err != nil {
		return nil, fmt.Errorf("cron.list: bad payload: %w", err)
	}
	jobs := make([]map[string]any, len(page.Jobs))
	for i, j := range page.Jobs {
		jobs[i] = translateCronJob(j)
	}
	return json.Marshal(map[string]any{"jobs": jobs})
}

// cronGet fetches one job's full record, translated the same way as
// cronList's entries — readJobRunResponse (jobs.ts) reads last_run_at/
// last_status straight off it when there's no nested latest_run/last_run/run.
func (c *ocClient) cronGet(jobID string) ([]byte, error) {
	payload, err := c.call("cron.get", map[string]any{"id": jobID})
	if err != nil {
		return nil, err
	}
	var job ocCronJob
	if err := json.Unmarshal(payload, &job); err != nil {
		return nil, fmt.Errorf("cron.get: bad payload: %w", err)
	}
	return json.Marshal(translateCronJob(job))
}

// cronRun triggers an out-of-schedule run (POST /api/jobs/{id}/run).
func (c *ocClient) cronRun(jobID string) error {
	_, err := c.call("cron.run", map[string]any{"id": jobID})
	return err
}

// cronSetEnabled pauses (enabled:false) or resumes (enabled:true) a job.
func (c *ocClient) cronSetEnabled(jobID string, enabled bool) error {
	_, err := c.call("cron.update", map[string]any{
		"id":    jobID,
		"patch": map[string]any{"enabled": enabled},
	})
	return err
}

var (
	ocJobsListRe  = regexp.MustCompile(`^/api/jobs$`)
	ocJobGetRe    = regexp.MustCompile(`^/api/jobs/([^/]+)$`)
	ocJobActionRe = regexp.MustCompile(`^/api/jobs/([^/]+)/(pause|resume|run)$`)
)

// doOpenClawAPI maps the app's Hermes-shaped job REST calls onto the
// Gateway's cron.* WS methods. Anything outside this small allow-list —
// including Hermes-only run approval/stop paths, which OpenClaw handles over
// the persistent WS push/resolve frames instead — is refused.
func doOpenClawAPI(method, path string, oc *ocClient) (int, string) {
	if method == "GET" && ocJobsListRe.MatchString(path) {
		body, err := oc.cronList()
		if err != nil {
			return http.StatusBadGateway, errBody(err)
		}
		return http.StatusOK, string(body)
	}
	if method == "GET" {
		if m := ocJobGetRe.FindStringSubmatch(path); m != nil {
			body, err := oc.cronGet(m[1])
			if err != nil {
				return http.StatusBadGateway, errBody(err)
			}
			return http.StatusOK, string(body)
		}
	}
	if method == "POST" {
		if m := ocJobActionRe.FindStringSubmatch(path); m != nil {
			jobID, action := m[1], m[2]
			var err error
			switch action {
			case "pause":
				err = oc.cronSetEnabled(jobID, false)
			case "resume":
				err = oc.cronSetEnabled(jobID, true)
			case "run":
				err = oc.cronRun(jobID)
			}
			if err != nil {
				return http.StatusBadGateway, errBody(err)
			}
			return http.StatusOK, `{}`
		}
	}
	return http.StatusForbidden, `{"error":"path not allowed"}`
}

func errBody(err error) string {
	raw, _ := json.Marshal(map[string]string{"error": err.Error()})
	return string(raw)
}

// readLoop is the single socket reader: approval pushes fire onApproval, turn
// events feed the active chat channel, a "res" matching a pending call() goes
// to its waiter, everything else is dropped. On read error it wakes any
// in-flight chat and pending calls via the done channel.
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
		var env struct {
			Type string `json:"type"`
			ID   string `json:"id"`
		}
		json.Unmarshal(raw, &env)
		if env.Type == "res" && env.ID != "" {
			c.mu.Lock()
			ch, ok := c.pendingCalls[env.ID]
			if ok {
				delete(c.pendingCalls, env.ID)
			}
			c.mu.Unlock()
			if ok {
				ch <- raw
				continue
			}
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
