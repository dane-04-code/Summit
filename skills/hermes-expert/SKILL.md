---
name: hermes-expert
description: >
  Integration reference for Hermes and OpenClaw API surfaces, connection
  architecture, and hard constraints. Use before writing any code that touches
  networking, chat, streaming, session management, run approval/stop, or the
  connect flow. Triggers on: "hermes", "openclaw", "api", "endpoint",
  "streaming", "SSE", "run approval", "capabilities", "connector", "relay",
  "session", "integration", "chat completions", or any question about how the
  app talks to the agent server.
---

# Hermes & OpenClaw Integration Expert

You know the Hermes and OpenClaw API surfaces, connection architecture, and
every hard constraint — cold. Before writing any integration code, load this
knowledge and hold it as the authoritative baseline. If something you're about
to write conflicts with a constraint below, stop and flag it.

For anything that goes beyond what's documented here, the canonical sources
are `FRAMEWORKS.md` (API surface) and `docs/CONNECTION.md` (architecture).
Read those directly rather than guessing.

---

## Connection Architecture

### The core constraint
Hermes is **inbound-only** — it can't dial out. A phone on cellular can't
reach a home LAN. Direct API calls from the phone require the user to expose
their server. That's harder than Telegram, which is disqualifying.

### Two modes
```
Default (relay):  phone ──► our relay ◄── native Hermes plugin ──► Hermes gateway
Fallback (relay): phone ──► our relay ◄── connector sidecar ──► Hermes :8642
Advanced (direct): phone ──► reachable host (tunnel / Tailscale) ──► Hermes :8642
```

**Relay is the default.** The native Hermes platform plugin is built in alpha and dials outbound to
our relay while using Hermes' native session/delivery surface. It surfaces a **6-digit pairing
code**; the phone pairs with it — no host URL, no API key on device, works on cellular. The Go
connector provides the same path as a compatibility fallback.

**The relay is built and working reliably in active testing.** Current V1 work is chat/output polish
and real-device proof, not rebuilding the transport.

### What relay buys us
- API key stays server-side (connector holds it). Phone has only a device token.
- App speaks **WebSocket** to the relay — no SSE brittleness on RN.
- Push falls out for free: relay already holds both ends.

### Pairing flow (relay mode, target)
1. User pastes a prompt to their agent → agent runs the connector install.
2. Connector dials relay, surfaces 6-digit code. Agent says the code.
3. User types code in app. Relay binds device ↔ agent.
4. App shows connected. Device token in Keychain. No host, no key, no account.

---

## Hermes API Surface

**Port:** `8642` · **Auth:** `Authorization: Bearer <API_SERVER_KEY>`

### First thing on connect
```
GET /v1/capabilities
```
Returns a feature-flag manifest. **Always call this before building UI** for
any optional feature. Key flags:
```json
{
  "features": {
    "chat_completions": true,
    "responses_api": true,
    "run_submission": true,
    "run_status": true,
    "run_events_sse": true,
    "run_stop": true,
    "run_approval": true   // ← gate the approve UI on THIS flag
  }
}
```

### Chat
```
POST /v1/chat/completions
{ "model": "hermes-agent", "messages": [...], "stream": true }
```

Two SSE event types — handle both:
- `chat.completion.chunk` — token deltas (standard OpenAI shape)
- `hermes.tool.progress` — tool-start visibility, does NOT persist to transcript

Session continuity headers on every request:
```
X-Hermes-Session-Id: <transcript-scoped-id>   // rotates on /new
X-Hermes-Session-Key: <stable-channel-id>     // max 256 chars, ties Honcho memory
```

Alternative: `POST /v1/responses` — stateful, chains via `previous_response_id`
or `conversation: "name"`. Hermes stores up to 100 responses (LRU eviction).

### Runs API — the headline feature
All endpoints confirmed in official docs. ✅
```
POST /v1/runs                    // create run → { run_id, status: "started" }
GET  /v1/runs/{id}               // poll: started | completed | failed | cancelled
GET  /v1/runs/{id}/events        // SSE stream — attach/detach without losing state
POST /v1/runs/{id}/stop          // interrupt → { status: "stopping" }
POST /v1/runs/{id}/approval      // resolve pending approval → run resumes
```

**Gate the approve UI on `run_approval: true` from `/v1/capabilities`.** Never
show it unconditionally.

### Health & discovery
```
GET /health              → { status: "ok" }  (also /v1/health)
GET /health/detailed     → sessions, running agents, resource usage
GET /v1/models           → agent profiles
GET /v1/skills           → loaded skills
GET /v1/toolsets         → concrete tool names
```

### Jobs API (scheduled runs)
```
GET    /api/jobs
POST   /api/jobs
GET    /api/jobs/{id}
PATCH  /api/jobs/{id}
DELETE /api/jobs/{id}
POST   /api/jobs/{id}/pause
POST   /api/jobs/{id}/resume
POST   /api/jobs/{id}/run   // trigger immediately
```

### Sessions API (session control)
```
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/{id}
PATCH  /api/sessions/{id}
DELETE /api/sessions/{id}
GET    /api/sessions/{id}/messages
POST   /api/sessions/{id}/fork
POST   /api/sessions/{id}/chat
POST   /api/sessions/{id}/chat/stream  // SSE: assistant.delta, tool.*, run.completed
```

---

## Hermes Hard Constraints — Never Design Around These

| Constraint | Detail |
|---|---|
| **No file upload** | Inline images only — `image_url` data URLs or remote https URLs. Don't promise or build file upload. |
| **One-server = one-agent** | No multi-agent endpoint. Multi-agent = multiple host+key pairs, app polls each. |
| **Model field is cosmetic** | Actual LLM is configured server-side. Ignore per-request model selection. |
| **Inbound-only** | Can't dial out. Relay requires a connector sidecar. No other option. |
| **`run_approval` is optional** | Gated behind capability flag. Not all Hermes versions have it. |

---

## OpenClaw API Surface (v2 — don't start yet)

**Port:** `18789` · **Auth:** `Authorization: Bearer <token>`

Custom routing headers:
```
x-openclaw-agent-id: main
x-openclaw-session-key: <key>
x-openclaw-message-channel: <ch>
x-openclaw-model: <model>
```

### Key endpoints
```
POST /v1/chat/completions   // OpenAI-compatible, same as Hermes
POST /v1/responses          // Disabled by default — enable in gateway config
GET  /v1/models
```

SSE events on `/v1/responses`:
`response.created` · `response.in_progress` · `response.output_text.delta` ·
`response.output_text.done` · `response.completed` · `response.failed`

### Critical differences from Hermes

| | Hermes | OpenClaw |
|---|---|---|
| Runs/Approval | ✅ REST (`/v1/runs/{id}/approval`) | ❌ WS-only — no REST equivalent yet (#20934) |
| Capabilities endpoint | ✅ `/v1/capabilities` | ❌ Not present |
| File upload | ❌ Inline images only | ✅ Images + PDFs + text (up to 10MB / 5MB) |
| Session headers | `X-Hermes-Session-Id/Key` | `x-openclaw-session-key`, `x-openclaw-agent-id` |
| Streaming | `hermes.tool.progress` custom event | Standard OpenResponses SSE |
| Architecture | REST primary | WebSocket primary, REST layered |
| Default port | 8642 | 18789 |
| Feature detection | `/v1/capabilities` | Try/catch or version-based |

**For OpenClaw in v2:** don't assume REST approve/stop — it's WebSocket-only
until GitHub issue #20934 ships. Plan for a WS control-plane connection.

---

## Adapter Interface (internal)

Both frameworks share `/v1/chat/completions` for basic chat but diverge on
everything else. Target adapter shape:

```typescript
interface AgentAdapter {
  testConnection(): Promise<Capabilities>
  sendMessage(content: string, sessionId?: string): AsyncIterable<StreamEvent>
  getStatus(): Promise<AgentStatus>   // idle | running | error
  approveRun(runId: string, approved: boolean): Promise<void>
  stopRun(runId: string): Promise<void>
  pollRun(runId: string): Promise<RunStatus>
  subscribeToRun(runId: string): AsyncIterable<RunEvent>
  listJobs(): Promise<Job[]>
  triggerJob(jobId: string): Promise<void>
}

interface Capabilities {
  framework: 'hermes' | 'openclaw'
  hasRunApproval: boolean
  hasRunStop: boolean
  hasStreaming: boolean
  hasJobs: boolean
  hasSessions: boolean
}
```

---

## Common Mistakes — Flag These

- **Showing approve UI without checking `run_approval` capability** — it's optional. Gate it.
- **Using `X-Hermes-*` headers on OpenClaw** — different headers, different semantics.
- **Designing file upload for Hermes** — not possible, inline images only.
- **Assuming OpenClaw has `/v1/capabilities`** — it doesn't. Feature detection is try/catch.
- **Building REST approve/stop for OpenClaw** — the REST gap exists. Plan for WebSocket.
- **Expecting `/v1/chat/completions` to select the LLM** — `model` field is cosmetic on both.
- **Assuming relay is built** — Phase 1 is direct mode. The relay and connector are not shipped.
- **Mixing session headers** — Hermes uses `X-Hermes-Session-Id/Key`; OpenClaw uses `x-openclaw-session-key`.
