# Framework Reference: Hermes Agent & OpenClaw
*For Claude Code — read this before touching any integration code.*
*Sourced directly from official documentation, June 2026.*

---

## HERMES AGENT

**By:** Nous Research  
**Released:** February 2026  
**License:** MIT  
**GitHub:** [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)  
**Docs:** https://hermes-agent.nousresearch.com/docs/  
**Default API port:** `8642`

### What It Is

Hermes is a self-hosted, open-source autonomous AI agent with persistent cross-session memory. It's designed to be your personal agent that grows over time — it creates skills from experience, searches past conversations, and builds a model of you across sessions using Honcho for long-term memory.

Key traits:
- **One server = one agent.** There's no multi-agent endpoint. If you want multiple agents, you run multiple profiles on different ports.
- **OpenAI-compatible API** — any frontend that speaks `/v1/chat/completions` works as a client.
- **Full toolset:** terminal, file operations, web search, memory, skills — all active via the API.
- **Model-agnostic:** works with Nous Portal, OpenRouter (200+ models), OpenAI, HuggingFace, local models, or any OpenAI-compatible endpoint.
- Runs on Linux, macOS, WSL2.

---

### Setup (User Does This Once)

Add to `~/.hermes/.env`:
```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=your-secret-key
API_SERVER_HOST=0.0.0.0       # 127.0.0.1 by default (localhost only)
API_SERVER_PORT=8642           # optional, 8642 is default
```

Start the server:
```bash
hermes gateway
```

The app onboarding should walk users through this.

---

### API Surface — Everything Confirmed from Docs

#### Authentication
```
Authorization: Bearer <API_SERVER_KEY>
```
Required on every request.

---

#### Core Chat Endpoints

**`POST /v1/chat/completions`** — Stateless, standard OpenAI format. Full conversation must be sent in each request's `messages` array.

```json
{
  "model": "hermes-agent",
  "messages": [
    {"role": "user", "content": "Run a search for X"}
  ],
  "stream": true
}
```

Streaming: SSE with two event types:
- Standard `chat.completion.chunk` — token deltas
- Custom `hermes.tool.progress` — tool-start visibility (doesn't pollute persisted assistant text)

Supports inline images (`image_url` parts in content array). **No file upload** — only inline images.

Session continuity headers:
```
X-Hermes-Session-Id: <transcript-scoped-id>    # rotates on /new
X-Hermes-Session-Key: <stable-channel-identity> # max 256 chars, ties into Honcho memory
```

---

**`POST /v1/responses`** — Stateful, OpenAI Responses API format. Server stores conversation history; client just chains `previous_response_id` across turns. Alternatively use `conversation: "my-project"` to get automatic chaining by name.

---

#### Status & Discovery

**`GET /v1/capabilities`** — Machine-readable feature flags. **Call this on first connect** to detect what the running Hermes version supports.

```json
{
  "object": "hermes.api_server.capabilities",
  "platform": "hermes-agent",
  "auth": {"type": "bearer", "required": true},
  "features": {
    "chat_completions": true,
    "responses_api": true,
    "run_submission": true,
    "run_status": true,
    "run_events_sse": true,
    "run_stop": true
  }
}
```

**`GET /health`** → `{"status": "ok"}` (also at `/v1/health`)  
**`GET /health/detailed`** → active sessions, running agents, resource usage  
**`GET /v1/models`** → lists connected agent(s) by profile name  

---

#### ✅ RUNS API — Confirmed, These Endpoints Exist

This is the headline feature for our app. Confirmed from official docs.

**`POST /v1/runs`** — Create a new agent run.
- Returns `{"run_id": "run_abc123", "status": "started"}`
- Accepts: `input` (string), optional `session_id`, `instructions`, `conversation_history`, `previous_response_id`

**`GET /v1/runs/{run_id}`** — Poll run state. Returns status, output, usage. Statuses: `started`, `completed`, `failed`, `cancelled`. Results are retained briefly after terminal states for UI reconciliation.

**`GET /v1/runs/{run_id}/events`** — SSE stream of tool-call progress, token deltas, and lifecycle events. Designed for "attach/detach without losing state" — exactly what a mobile client needs.

**`POST /v1/runs/{run_id}/stop`** — Interrupt a running turn. Returns `{"status": "stopping"}` immediately; Hermes stops at next safe interruption point.

**`POST /v1/runs/{run_id}/approval`** — **THE KEY FEATURE.** Resolve a pending approval (e.g., a tool call gated behind an approval policy). Run resumes after decision is recorded. This endpoint is advertised in `/v1/capabilities` as `run_approval` — check for this flag before showing the approve UI.

---

#### Jobs API (Scheduled/Background Runs)

Manage cron-style scheduled agent work from a remote client:

```
GET    /api/jobs
POST   /api/jobs          # create (same shape as hermes cron)
GET    /api/jobs/{id}
PATCH  /api/jobs/{id}     # partial update
DELETE /api/jobs/{id}
POST   /api/jobs/{id}/pause
POST   /api/jobs/{id}/resume
POST   /api/jobs/{id}/run  # trigger immediately, out of schedule
```

---

#### Sessions API (Session Control over REST)

```
GET    /api/sessions                          # list (paginated)
POST   /api/sessions                          # create empty session
GET    /api/sessions/{id}                     # read metadata
PATCH  /api/sessions/{id}                     # update title / end_reason
DELETE /api/sessions/{id}
GET    /api/sessions/{id}/messages            # message history
POST   /api/sessions/{id}/fork               # branch session (matches /branch CLI)
POST   /api/sessions/{id}/chat               # synchronous agent turn
POST   /api/sessions/{id}/chat/stream        # SSE turn (emits assistant.delta, tool.started, tool.completed, run.completed)
```

---

#### Skills & Toolset Discovery

```
GET /v1/skills       # list skills the agent has loaded
GET /v1/toolsets     # list toolsets with their concrete tool names
```

---

### Important Limitations (Confirmed)

- **No file upload** — inline images only (`image_url` data URLs or remote https URLs). Don't promise file upload.
- **One-server-one-agent** — no unified multi-agent endpoint. App must store and poll multiple host+key pairs.
- **Model field is cosmetic** — actual LLM is configured server-side, not chosen per-request.
- Stored responses (for `previous_response_id`) max 100 entries (LRU eviction).

---

---

## OPENCLAW

**GitHub:** [openclaw/openclaw](https://github.com/openclaw/openclaw) — 180K+ stars  
**Site:** https://openclaw.ai  
**Docs:** https://docs.openclaw.ai  
**Default Gateway port:** `18789`  
**Status (2026):** Founder Peter Steinberger joined OpenAI Feb 2026; project transitioning to an independent open-source foundation.

### What It Is

OpenClaw is a self-hosted personal AI assistant that functions as a multi-platform **gateway** — it connects 24+ messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, Teams, and many more) to AI agents. Its strength is the **outbound messaging breadth** — you talk to it from wherever you already chat.

Key traits:
- **Multi-agent, multi-channel architecture** — fundamentally different from Hermes. Has Nodes, Channels, Agents, and a Gateway as separate concepts.
- **WebSocket-first control plane** — the primary protocol is WebSocket-based. REST endpoints exist but are layered on top.
- **ClawHub skill registry** — community SKILL.md skills (similar to Hermes but separate ecosystem). SkillSpector security scanning added May 31, 2026.
- **Model-agnostic** — routes to any provider.
- Security history: 9 CVEs in ~4 days (one CVSS 9.9) in 2025 — now has formal verification, MITRE ATLAS threat model. Security posture improving but historically rocky.

---

### Architecture Concepts

```
Gateway          — single control plane. WS + HTTP multiplex on one port.
Channels         — ingress surfaces (Telegram, Slack, WhatsApp, WebChat, etc.)
Agents           — the AI that handles messages (default: "main")
Nodes            — compute/media execution environments
ClawHub          — skill/plugin registry
```

---

### API Surface — What's Confirmed from Docs

#### Authentication

Multiple modes configured in gateway config:
```yaml
gateway.auth.mode: "token"     # Bearer token shared secret — what most self-hosters use
                  "password"   # similar
                  "trusted-proxy"  # identity from proxy headers
                  "none"       # open auth (private ingress only)
```

For `token`/`password` mode:
```
Authorization: Bearer <token>
```

Custom headers for routing:
```
x-openclaw-agent-id: main          # target a specific agent (default: main)
x-openclaw-session-key: <key>      # explicit session routing
x-openclaw-message-channel: <ch>   # non-default ingress channel
x-openclaw-model: <model>          # override the agent's backend model
```

---

#### REST Endpoints (HTTP layer on top of WS)

> ⚠️ **Both HTTP endpoints are disabled by default** — verified live against Gateway
> 2026.6.11 (July 2026): `/v1/chat/completions` returns 404 and `/v1/models` serves the
> Control-UI HTML on a stock install. Enable via
> `gateway: { http: { endpoints: { chatCompletions: { enabled: true }, responses: { enabled: true } } } }`.
> The WS control plane (what our connector uses) needs no such config.

**`POST /v1/chat/completions`** — OpenAI-compatible, same port as Gateway. Target agent via `model: "openclaw"`, `model: "openclaw/<agentId>"`, or `x-openclaw-agent-id` header.

**`POST /v1/responses`** (OpenResponses API) — Supports SSE streaming. Stateless per request by default; stable session derived from `user` field if provided.

SSE event types: `response.created`, `response.in_progress`, `response.output_item.added`, `response.content_part.added`, `response.output_text.delta`, `response.output_text.done`, `response.output_item.done`, `response.completed`, `response.failed`

**`GET /v1/models`**, **`GET /v1/models/{id}`** — model/agent listing  
**`POST /v1/embeddings`** — pass-through to provider  

---

#### ⚠️ Key Difference from Hermes: No Native Runs/Approval API

OpenClaw has **no `/v1/runs` equivalent** in its REST surface. The approval/control mechanism is WebSocket-based (the primary control plane). This means:

- You **cannot** implement a one-tap approve/stop from a mobile REST client the same way you can with Hermes.
- Control plane operations (approve, pause, status) require either a WebSocket connection or using the REST session management endpoints (which have a documented gap as of Feb 2026 — `GET /issues/20934` on GitHub tracking REST session management as a feature request).
- For v1 of our app targeting Hermes: this doesn't matter. For OpenClaw integration in v2: plan for WS or check if that GitHub issue has shipped.

---

#### File & Image Support

Unlike Hermes, OpenClaw's `/v1/responses` **does support file upload**:
- Images: JPEG, PNG, GIF, WebP, HEIC, HEIF — up to 10MB
- Files: plain text, markdown, HTML, CSV, JSON, PDF — up to 5MB
- Both URL-based and base64 (`input_image`, `input_file` input items)

---

### OpenClaw vs Hermes — Key Differences for Our App

| Aspect | Hermes | OpenClaw |
|--------|--------|----------|
| Architecture | One server = one agent | Multi-agent gateway |
| Primary protocol | REST/HTTP | WebSocket (REST layered on top) |
| Runs/Approval API | ✅ Native REST (`/v1/runs/{id}/approval`) | ❌ WS-based only (REST gap tracked in #20934) |
| Session headers | `X-Hermes-Session-Id`, `X-Hermes-Session-Key` | `x-openclaw-session-key`, `x-openclaw-agent-id` |
| Default port | 8642 | 18789 |
| File upload | ❌ Inline images only | ✅ Images + PDFs + text files |
| Streaming events | `hermes.tool.progress` (custom) | Standard OpenResponses SSE events |
| `/v1/capabilities` | ✅ Full feature flag manifest | ❌ Not present |
| Skills | ClawHub-compatible SKILL.md | ClawHub SKILL.md |
| Security history | Conservative, no known CVEs | Rocky (9 CVEs 2025), improving |
| Memory | Honcho long-term memory built-in | Per-session by default |

---

## BUILD IMPLICATIONS

### For Phase 1 (Hermes MVP)

1. **Connection:** `GET /v1/capabilities` on connect — verify `run_approval: true` before showing approve UI.
2. **Chat:** Use `/v1/chat/completions` with `stream: true`. Handle two SSE event types: `chat.completion.chunk` and `hermes.tool.progress`.
3. **Session continuity:** Send both `X-Hermes-Session-Id` and `X-Hermes-Session-Key` headers on every request.
4. **Approve/Stop:** Use `POST /v1/runs/{id}/approval` and `POST /v1/runs/{id}/stop` — both confirmed and documented. ✅
5. **Status polling:** `GET /v1/runs/{run_id}` or `GET /health/detailed`.

### For Phase 2 (OpenClaw)

1. **Don't assume REST approval flow** — it doesn't exist yet. Plan for a WebSocket connection for control plane operations, or wait until issue #20934 ships.
2. **Session routing is different** — use `x-openclaw-agent-id` and `x-openclaw-session-key` headers instead of Hermes headers.
3. **Capability detection** — no `/v1/capabilities` equivalent, so feature detection must be done differently (try/catch or version-based).
4. **File upload is possible** — OpenClaw supports it if we want to add it later.

### Adapter Interface (Internal)

Both frameworks speak `/v1/chat/completions` for basic chat, but differ significantly on everything else. The internal adapter interface should look like:

```typescript
interface AgentAdapter {
  // connection
  testConnection(): Promise<Capabilities>
  
  // chat
  sendMessage(content: string, sessionId?: string): AsyncIterable<StreamEvent>
  
  // status
  getStatus(): Promise<AgentStatus>  // idle | running | error
  
  // runs (Hermes only in v1)
  approveRun(runId: string, approved: boolean): Promise<void>
  stopRun(runId: string): Promise<void>
  pollRun(runId: string): Promise<RunStatus>
  subscribeToRun(runId: string): AsyncIterable<RunEvent>
  
  // jobs (optional, Hermes v1)
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

## USEFUL LINKS

- [Hermes API Server docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server)
- [Hermes Programmatic Integration](https://hermes-agent.nousresearch.com/docs/developer-guide/programmatic-integration)
- [Hermes GitHub](https://github.com/NousResearch/hermes-agent)
- [OpenClaw docs](https://docs.openclaw.ai)
- [OpenClaw OpenResponses API](https://docs.openclaw.ai/gateway/openresponses-http-api)
- [OpenClaw OpenAI Chat Completions](https://docs.openclaw.ai/gateway/openai-http-api)
- [OpenClaw GitHub issue #20934 — REST session management](https://github.com/openclaw/openclaw/issues/20934)
