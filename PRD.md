# Product Requirements Document
## Mobile Companion App for Personal AI Agents
**Codename: Agent Messenger** | Version 0.2 | June 2026

> **v0.2 reframe (2026-06-25):** Connection model changed from *direct API client* to
> *relay-first* (outbound, Telegram-shaped). A direct client requires the user to expose their
> self-hosted server, which is strictly harder to set up than the Telegram bot we're replacing —
> disqualifying. See [`docs/CONNECTION.md`](docs/CONNECTION.md). This reframes §2, §6, §7, §8,
> and Open Decision #2.

---

## 1. Problem Statement

People running self-hosted AI agents (Hermes, OpenClaw) manage them from a desktop dashboard. When away from their desk, the only option is raw Telegram/Discord bots — and the whole *experience* of working with your agent on mobile falls apart there. The flow is wrong end to end: you can't act on a blocking "approve/stop" decision cleanly, you get no real status (idle / running / error), and the agent's output is mangled — markdown tables, headings, and code blocks render as unreadable plain text. That last one is the most *visible* symptom, but the real gap is that there's no mobile client that makes talking to your agent feel like a first-class app instead of a degraded chat bot.

This is a structural gap, not a tooling gap. The popular Scarf companion app (macOS) is architecturally stuck on desktop because it reads local SQLite files and spawns CLI subprocesses — neither works on mobile. The gap isn't unaddressed by laziness; it's unaddressed because the obvious approach doesn't work on mobile. An API-based approach is the correct and necessary path.

**Connection caveat (v0.2):** "API-based" must not mean "direct client." Per `FRAMEWORKS.md`, Hermes is an **inbound-only API server** (`:8642`) sitting behind NAT; a phone on cellular can't reach it without the user exposing their server (port-forward / tunnel / VPN). Telegram works from anywhere not because *Hermes* dials out — it can't — but because a **bridge process** next to Hermes dials outbound to Telegram's cloud. We mirror that with our own **connector sidecar → relay**, so it's as easy as Telegram rather than harder. See §6 and [`docs/CONNECTION.md`](docs/CONNECTION.md).

---

## 2. Product Vision

A React Native (iOS first) mobile app that connects to self-hosted AI agent frameworks via their API servers, giving users a clean interface to monitor, chat with, and act on their agents from anywhere — fixing specific, real problems that Telegram/Discord have, not replacing them as everyday messengers.

**One-line pitch:** "The mobile client your AI agent deserves — reach it from anywhere and work with it like a real app, not a degraded chat bot."

**What we're actually selling is the *flow*:** a fast, fluent mobile experience for your agent — pair in seconds, message it smoothly, see its status, and act on it with one tap. Proper markdown, push, and approve/stop are *parts* of that experience, not the headline. The differentiator is the whole thing feeling first-class; markdown rendering is the most visible piece of it, not the point of it.

**UI direction:** Dark by default — clean, calm, premium. **Not white/stark.** One restrained accent, system font, generous spacing. Full tokens in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md). (Light mode is a possible later option; dark is the product's look.)

**Connection model:** Relay-first, like Telegram. A small **connector** next to Hermes dials outbound to a relay (Hermes is inbound-only and can't dial out itself); the user pairs the app with a **6-digit code** — no host URL, no exposed server, no accounts, works on cellular. The connector can be installed by the agent itself (agent-assisted onboarding). A **direct host+key mode** remains available as an advanced option for the Tailscale / no-middleman crowd. Full rationale in [`docs/CONNECTION.md`](docs/CONNECTION.md).

---

## 3. Target Users

**Primary:** Technical self-hosters running personal/business agents on Hermes or OpenClaw. Active in r/openclaw and the Hermes/OpenClaw Discord communities. Already comfortable setting up API servers, bearer tokens, and self-hosted infrastructure.

**Not targeting:**
- Mainstream consumers (no agent to connect to)
- Matrix/E2EE maximalists (philosophical non-fit — they want to minimize surfaces touching their agent, not add a polished client)
- Enterprise/team buyers (not in v1)

---

## 4. Goals & Non-Goals

### Goals
- **Deliver a fluent, first-class mobile flow** — pairing in seconds, smooth messaging, quick transitions; the experience is the product
- Let users connect to their self-hosted Hermes instance in under 2 minutes (agent-assisted pairing)
- Render markdown output (tables, headings, code blocks with syntax highlighting) properly — the most visible part of that experience
- Enable approve/stop actions on running agent tasks from the phone
- Provide a meaningful status view (idle / running / error) per agent
- Lay groundwork for multi-framework support via a clean adapter pattern

### Non-Goals (v1)
- Built-in voice (Hermes and OpenClaw already ship native voice)
- Social features: group chats, reactions, read receipts, typing indicators
- File upload (Hermes API doesn't support it — inline images only)
- Multi-agent management (v2+)
- OpenClaw integration (v2, needs its own research pass)
- Fully automated adapter layer for arbitrary new frameworks (v2+)

---

## 5. Feature Scope

### MVP (Phase 1 + 2 — build these first)

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Onboarding (agent-assisted pairing)** | User pastes a prompt to their agent → the agent installs its own connector and reads back a **6-digit code** → user types it in the app. No host/key on the phone; relay device token in Keychain. Fallbacks: run the one-liner manually, or **direct mode** (host + key). See `docs/CONNECTION.md` §5/§5a. |
| 2 | **Chat with agent** | `POST /v1/chat/completions`, SSE streaming, `X-Hermes-Session-Id` + `X-Hermes-Session-Key` headers for continuity |
| 3 | **Proper markdown rendering** | Real tables, headings, code blocks with syntax highlighting. Handles partial/streaming markdown gracefully. A core part of the "real client" experience (see §2) — the most *visible* upgrade over a raw Telegram bot, but in service of the overall flow, not the whole point. |
| 4 | **Agent status indicator** | Idle / running / error — via polling `/health` or `/v1/runs/{id}` |
| 5 | **Reply from app** | Standard message send; nothing fancy in v1 |
| 6 | **Approve / Stop actions** | `POST /v1/runs/{run_id}/approval`, `POST /v1/runs/{run_id}/stop` — ⚠️ UNVERIFIED, must confirm these endpoints exist before building UI |

### Phase 2 (after MVP validates)

| # | Feature | Notes |
|---|---------|-------|
| 7 | **Push notifications** | Requires a relay server — Hermes can't push to APNs directly. Decide: build relay now, or ship polling-only in v1? |
| 8 | **Smart notification types** | Finished / needs input / errored, with per-type mute |
| 9 | **Quick-reply from notification** | Approve / retry / pause without opening app |
| 10 | **Multi-agent support** | Multiple host+key pairs; Hermes is one-server-one-agent, so no shortcut |

### Backlog (v2+, do not start until MVP validated)

- Cross-agent search
- "Last result" pin per agent
- Cost/usage glance per agent (if API exposes it)
- Agent-defined status widgets (JSON from agent → rendered card)
- OpenClaw integration (second adapter)
- Formal adapter abstraction layer (built from real cases, not guessed in advance)

---

## 6. Technical Architecture

### Connection model (relay-first) — see [`docs/CONNECTION.md`](docs/CONNECTION.md)
The app is **not** a direct API client by default. A self-hosted Hermes is unreachable from a phone
off the home network, so the original direct-client model only worked on WiFi — defeating the core
"from anywhere" promise and making setup harder than the Telegram bot we replace.

Hermes is inbound-only and cannot dial out (`FRAMEWORKS.md`), so we mirror Telegram's shape with a
**connector sidecar**: a small process running next to Hermes that talks to `localhost:8642` and
**dials outbound to a relay we operate; the app connects to the relay; the relay bridges them.**
Pairing is a 6-digit code. Benefits beyond reachability:
- **API key never touches the phone** — it stays server-side with the connector; the device holds
  only a relay token.
- **App talks WebSocket to the relay, not SSE** — sidesteps the RN SSE brittleness (see §9).
- **Push notifications fall out of the same channel** — the connection relay *is* the push relay
  (resolves the §6 "Push Notification Relay" question and Open Decision #2).

**Direct mode** (app → reachable host + API key via domain/tunnel/Tailscale) is retained as an
advanced, zero-infra option for users who refuse a middleman.

### Stack
- **React Native** (iOS first, Android to follow)
- **Expo** recommended for faster iteration and OTA updates
- **Secure storage:** `expo-secure-store` (iOS Keychain)
- **SSE streaming:** `react-native-sse` or `EventSource` polyfill (native `fetch` doesn't stream well on RN)
- **Markdown rendering:** Custom solution on top of `react-native-markdown-display` or similar, with special handling for partial/streaming content

### Hermes Integration (confirmed)
```
Base URL:       User-configured (e.g., https://my-hermes.example.com)
Auth:           Authorization: Bearer <api_key>
Chat endpoint:  POST /v1/chat/completions   (OpenAI-compatible)
Streaming:      SSE — standard chat.completion.chunk + custom hermes.tool.progress events
Session:        X-Hermes-Session-Id (transcript) + X-Hermes-Session-Key (stable identity)
Capabilities:   GET /v1/capabilities  (check on connect, handle version differences)
Health:         GET /health  or  GET /health/detailed
```

### Runs API (⚠️ Reported, NOT verified — verify before building)
```
Create run:     POST /v1/runs
Poll status:    GET /v1/runs/{id}
Event stream:   GET /v1/runs/{id}/events  (SSE)
Stop:           POST /v1/runs/{id}/stop
Approve:        POST /v1/runs/{id}/approval
```

### Sessions API (⚠️ Reported, NOT verified)
```
List/create:    GET/POST /api/sessions
Messages:       GET /api/sessions/{id}/messages
Fork:           POST /api/sessions/{id}/fork
Chat:           POST /api/sessions/{id}/chat  |  /chat/stream
```

### Adapter Pattern (internal)
The app exposes a clean internal interface to all UI components:
```typescript
interface AgentAdapter {
  sendMessage(content: string, sessionId?: string): AsyncIterable<ChunkEvent>
  getStatus(): Promise<AgentStatus>
  approveRun(runId: string): Promise<void>
  stopRun(runId: string): Promise<void>
  getCapabilities(): Promise<Capabilities>
}
```
`HermesAdapter` implements this for v1. `OpenClawAdapter` follows in v2. This keeps the UI decoupled from framework specifics without over-engineering before we know what OpenClaw's API actually looks like.

### Push Notification Relay → folded into the connection relay
**v0.2:** This is no longer a separate Phase-2 question. The connection relay (above) already holds
a persistent outbound channel from Hermes and a device token for the phone, so it can forward events
to APNs directly. Connection and push are **one system, built once.** The earlier "relay vs.
polling" framing assumed a direct-client app that only needed a relay for push; under the relay-first
model the relay exists from day one and push is a feature of it, not new infra.

Open-core opportunity stands: free **self-hostable** relay (also the privacy/trust mitigation for
users wary of a hosted middleman), paid hosted relay.

---

## 7. User Flows

### Flow 1 — First-time setup (agent-assisted pairing)
The headline path makes the agent install its own connector — the user only relays a code. The
connector install is the only real friction in relay mode, and the agent (with terminal/file tools
on the Hermes box) is the perfect thing to do it. See `docs/CONNECTION.md` §5a.

1. App opens → pair screen shows a **copyable prompt** + a 6-digit code field
2. User pastes the prompt to their agent wherever they already chat with it (desktop, Telegram, CLI)
3. Agent runs a fixed install one-liner → connector **daemonizes**, dials the relay, gets a 6-digit
   code → agent **says the code back** in chat
4. User types the 6 digits → relay binds device ↔ agent; capabilities (name/version) forwarded back
5. App shows `✓ Connected to Hermes v2.4` → slides into the chat view
6. Onboarding tip overlay explains markdown rendering + approve button

*Manual relay path (no agent):* user runs the same one-liner on the server themselves, reads the
code. *Advanced (direct) path:* tap "Connect manually" → paste reachable host URL + API key → app
calls `GET /v1/capabilities` → same landing (for users who expose Hermes themselves and want no
relay). Direct mode is also the fallback when the agent is sandboxed and can't run the installer.

### Flow 2 — Chat loop
1. User types message → `POST /v1/chat/completions` (streaming)
2. SSE chunks arrive → markdown rendered incrementally as tokens stream in
3. Tool progress events (`hermes.tool.progress`) → shown as inline status chips ("Searching the web…")
4. Agent finishes → full markdown rendered cleanly; approve/stop buttons visible if a run is pending

### Flow 3 — Approve a blocking action (if endpoints verified)
1. Agent hits a decision point (e.g. "Should I run this shell command?")
2. Push notification arrives (Phase 2) or user sees pending state in app
3. User taps "Approve" or "Stop" → `POST /v1/runs/{id}/approval` or `/stop`
4. Agent resumes / halts

---

## 8. Screen Map (MVP)

```
App
├── Pair Screen             — copyable agent prompt + 6-digit code field (default); "Connect manually" → host+key (advanced)
├── Agent View              — the main page
│   ├── Chat Thread         — message list with streaming markdown (one-sided message containers, no bubbles)
│   ├── Status (in header)  — idle / running / error + run metadata
│   ├── Action Request      — approve / stop card, full-width, shown on a pending run
│   └── Left Drawer         — slide-over: New chat · Recent sessions · Settings
└── Settings (in drawer)
    ├── Connection           — re-pair, or edit host/key (advanced mode), re-test
    └── Notifications        — push toggle + per-type mute (relay handles delivery)
```

---

## 9. Build Phases & Estimates

| Phase | What | Difficulty | Rough Estimate |
|-------|------|-----------|----------------|
| 1 | Connect + chat + streaming markdown | Medium | 2–3 weeks solo |
| 2 | Status polling + approve/stop UI | Medium (if endpoints verified) | 1 week |
| 3 | Push notifications + relay | Medium-hard | 1–2 weeks + ongoing infra |
| 4 | OpenClaw adapter + abstraction layer | Hard | v2 milestone |

**Phase 1 honest complexity notes:**
- **Relay mode moves the streaming problem off the device:** the app reads WebSocket frames from the relay, and the relay terminates Hermes's SSE server-side. The brittle RN-SSE work shifts into the relay (a normal server environment), not the app. *Direct mode* still needs an RN SSE library (`fetch` doesn't stream natively on RN) — another reason direct is the advanced path.
- Streaming markdown is genuinely fiddly: partial tokens can split mid-table-cell, mid-code-fence. Off-the-shelf RN markdown libraries aren't built for incremental input. Plan for custom buffering logic. (Unchanged by transport — happens wherever tokens are rendered.)

---

## 10. Open Decisions

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| 1 | **Verify Runs API** | ✅ Confirmed | `FRAMEWORKS.md` confirms from official docs: `/v1/runs`, `/v1/runs/{id}` (poll), `/v1/runs/{id}/events` (SSE), `/v1/runs/{id}/stop`, `/v1/runs/{id}/approval`. Advertised as `run_approval` in `/v1/capabilities` — check the flag at runtime, no doc verification outstanding. |
| 2 | **Connection transport: relay vs direct** | 🔴 Reframed (was "push: relay vs polling") | **Gates the whole product, not just push.** Relay-first is the chosen direction (see `docs/CONNECTION.md`) because a direct client only works on home WiFi and is harder to set up than Telegram. Remaining sub-decisions: hosted vs self-host-only for v1; ship direct mode in v1 or relay-only first; E2E vs TLS-to-relay. |
| 3 | **Monetization** | 🟡 Open | Open-core (free app + paid hosted relay) vs. paid team tier vs. none. In tension with community's OSS/free preference. |
| 4 | **Community validation** | 🔴 Not done | Post in Hermes/OpenClaw Discord before building. Confirm real demand. |
| 5 | **OpenClaw API shape** | 🔴 Not researched | Don't assume parity with Hermes. Needs dedicated research pass. |
| 6 | **Demo/launch plan** | 🟡 Open | Likely short screen recording showing markdown + approve flow, posted to r/openclaw / Hermes Discord. |

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Connector sidecar is friction (Hermes has no native outbound hook — confirmed) | High | Medium | Relay mode *requires* the sidecar. Make install trivial (single binary / Docker / `pip`); direct mode skips it for the Tailscale crowd |
| Relay becomes a critical single point of failure / infra cost | Medium | High | Keep relay thin (rendezvous only); make it self-hostable (open-core); direct mode bypasses it entirely |
| Relay-in-the-middle deters privacy-conscious users | Medium | Medium | Self-hostable relay + optional E2E + direct mode; key never leaves the server in relay mode |
| ~~Runs API endpoints don't exist as described~~ **Resolved** | — | — | Confirmed in `FRAMEWORKS.md` (`/v1/runs/{id}/approval` + `/stop` documented). Residual: gate the UI on the `run_approval` capability flag at runtime in case an older Hermes lacks it. |
| Hermes ships their own iOS app before we launch | Low-Medium | High | Move fast on Phase 1; differentiate on cross-framework support |
| SSE streaming on RN is brittle/performant issue | Medium | Medium | Spike on this early in Phase 1 |
| Community prefers free/OSS → no clear monetization | High | Medium | Validate community appetite before investing in relay infra |
| OpenClaw's API is too unstable to build against reliably | Medium | Medium | Don't start OpenClaw adapter until Hermes version is shipped and stable |

---

## 12. Immediate Next Steps (in priority order)

1. **Build the connector sidecar** — `FRAMEWORKS.md` confirms Hermes is inbound-only, so relay mode *requires* a small sidecar that bridges `localhost:8642` ↔ our relay. Spike it first; it gates the connection model. Decide packaging (binary / Docker / `pip`) for trivial install. (See `docs/CONNECTION.md` §7.)
2. ~~Verify Hermes Runs API~~ **Already confirmed** in `FRAMEWORKS.md` — `/v1/runs/{id}/approval`, `/stop`, `/events` (SSE), and the lifecycle are documented, with `run_approval` advertised in `/v1/capabilities`. (Supersedes the "🔴 unverified" status in §10/§11 — check the capability flag at runtime, but no doc verification needed.)
3. **Relay spike** — minimal rendezvous: connector dials out (WSS), app pairs by code, one message round-trips. Proves the architecture before any UI is built on it. Replaces the standalone "SSE on RN" spike — the app reads WebSocket frames from the relay, not SSE.
4. **Community validation post** — post in Hermes Discord / r/openclaw: *"When I'm away from desktop, is there anything that gives you agent status + quick chat on your phone, instead of raw Telegram?"*
5. **Design pair + chat screens** — wireframes before coding UI (relay pairing screen, not host form).
6. **Begin Phase 1 build** — pair screen → chat thread → streaming markdown render.

---

## 13. Explicitly Out of Scope (won't revisit without strong new reason)

- Built-in voice (already native in Hermes/OpenClaw)
- Reactions, read receipts, typing indicators
- Group chats / multi-human social features
- File upload in v1
- Matrix/E2EE privacy-maximalist segment
- Automatic compatibility with arbitrary new frameworks (adapter is manual, not magic)

---

*Last updated: 2026-06-25 (v0.2 — relay-first connection reframe) | Author: Dane*
