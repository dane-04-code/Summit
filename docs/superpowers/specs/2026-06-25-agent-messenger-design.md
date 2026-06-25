# Agent Messenger — v1 First Slice Design

**Date:** 2026-06-25
**Author:** Dane (with Claude Code)
**Status:** Approved scope, pending spec review
**Source PRD:** `PRD.md` · **Framework reference:** `FRAMEWORKS.md`

---

## 1. What we are building (first slice)

A React Native (Expo) mobile app — iOS and Android from one codebase — that connects
to a self-hosted **Hermes Agent** API server and gives a clean chat client with
**proper streaming markdown**, which the existing Telegram/Discord bots cannot do.

**First slice = four things, all on Hermes' confirmed REST surface:**

1. **Connect** — paste host + API key, test the connection.
2. **Chat** — send a message, stream the reply over SSE.
3. **Streaming markdown render** — tables, headings, code blocks with syntax
   highlighting, rendered incrementally without breaking on partial syntax. *This is
   the #1 differentiator.*
4. **Status pill** — idle / running / error.

Built and smoke-tested against Dane's **live Hermes instance**; the streaming renderer
is tested against **recorded SSE fixtures** for determinism.

## 2. Non-goals (this slice)

- Approve / Stop and the runs lifecycle — **slice 2** (confirmed real, deliberately deferred).
- Push notifications / relay — later phase; v1 is polling/foreground only.
- Multi-agent, OpenClaw, file upload, voice, social features — out, per PRD.
- **No `AgentAdapter` interface** — see §4.

## 3. Stack

| Concern | Choice |
|---|---|
| Framework | Expo (React Native), New Architecture / Fabric |
| Ship / update | EAS Build + Submit + Update (OTA) |
| Navigation | Expo Router (file-based) |
| Chat list | FlashList |
| Animation / gesture | Reanimated + Gesture Handler |
| Streaming | `react-native-sse` (native `fetch` does not stream on RN) |
| Markdown | `react-native-markdown-display` + custom stabilization buffer |
| Secure storage | `expo-secure-store` (iOS Keychain / Android Keystore) |
| State | plain React state; add Zustand only if a screen genuinely needs shared state |

Cross-platform single codebase chosen over native Swift+Kotlin (2× work) and over
Flutter (throws away the OpenAI-compatible JS/SSE ecosystem + OTA). Decision inherited
from PRD and confirmed.

## 4. Architecture — agnostic UI, thin transport

The product principle (Dane's): **the app should not differ by agent.** The framework
docs confirm this is *mostly* true — rendering markdown and basic chat
(`/v1/chat/completions`) are identical across Hermes and OpenClaw. They differ only in
the **control plane** (Hermes = REST runs API; OpenClaw = WebSocket only), and that
only matters in v2.

```
  Hermes API ──►  hermes.ts (transport)  ──►  text + stream events  ──►  shared UI
                  (per-agent, thin)             (normalized shape)        (agnostic)
```

```
src/
  hermes.ts          # all Hermes HTTP/SSE. Plain functions, no interface.
                     #   connect()/getCapabilities(), sendMessage(), getHealth()
  storage.ts         # expo-secure-store wrapper: host + key
  markdown/          # streaming markdown renderer + stabilization buffer (§6)
  app/               # Expo Router screens (§7)
    index.tsx        #   Connect
    agent.tsx        #   Agent (chat + status)
    settings.tsx     #   Settings
```

**No `AgentAdapter` interface in v1.** An interface is a promise about what *all*
agents look like; with one implementation it can only be a guess about OpenClaw — whose
control plane is a different protocol (WebSocket). We write plain `hermes.ts` now and,
in v2, extract the shared interface from `hermes.ts` + `openclaw.ts` as two real cases.
This is the PRD's own backlog principle ("built from real cases, not guessed in
advance") applied consistently, and it is *less* code now, not more.

## 5. Hermes integration (endpoints used this slice)

- **Auth:** `Authorization: Bearer <API_SERVER_KEY>` on every request. Default port `8642`.
- **Connect test:** `GET /v1/capabilities` → confirm reachability + show agent name and
  feature flags. (Used later to gate the slice-2 approve UI via `run_approval`.)
- **Chat:** `POST /v1/chat/completions` with `stream: true`. Stateless — the full
  `messages` array is sent each request (client holds the transcript in memory for the
  session).
- **SSE event types to handle:**
  - `chat.completion.chunk` — token deltas → appended to the streaming message.
  - `hermes.tool.progress` — tool-start visibility → rendered as an inline status chip
    ("Searching the web…"), kept separate from persisted assistant text.
- **Session continuity headers** on every chat request:
  - `X-Hermes-Session-Id` (transcript-scoped) and `X-Hermes-Session-Key` (stable identity).
- **Health:** `GET /health` → `{"status":"ok"}` for the reachability ping.

## 6. Streaming markdown (the hard part)

**Approach: re-parse + stabilization buffer.** Render committed text as markdown, but
hold the trailing *incomplete* block as plain text until it is syntactically closed,
then promote it. Re-parses are throttled to ~1 per animation frame.

Stabilization rules (minimum viable set):

- **Open code fence** (odd number of ` ``` `) → render everything after the last open
  fence as plain monospace until the closing fence arrives.
- **Partial table row** (trailing line starts a table but has no newline yet) → hold
  that line as plain text until the line completes.
- Everything before the unstable tail renders as normal markdown immediately.

**Why not an incremental parser:** messages are a few KB; full re-parse per frame is
cheap. Defer the incremental parser until a profiler demands it (YAGNI).

**Deterministic testing:** record real SSE responses from the live Hermes instance into
fixture files — including a split code fence and a table cell split across chunks —
then replay them through the buffer in unit tests. Real data, reproducible, no mock
server.

## 7. Screens

```
Connect (app/index)   host + key inputs, "Test connection" → GET /v1/capabilities,
                      shows agent name + version on success, stores creds on continue
Agent   (app/agent)   FlashList chat thread, streaming markdown, status pill,
                      message composer
Settings(app/settings) edit host/key + retest, health-poll interval
```

**Onboarding = the Connect screen, nothing more.** Audience is technical self-hosters,
so no welcome carousel or wizard — the goal is "connected in under 2 minutes." The
screen carries an expandable **"Where do I find these?"** help block with the actual
Hermes setup (`~/.hermes/.env`: `API_SERVER_ENABLED=true`, `API_SERVER_KEY`, port
`8642`; then `hermes gateway`), because the #1 first-run failure is the API server not
running yet. Connection results are **specific**, not generic:

| Result | Message |
|---|---|
| reached + valid | "Connected to `<platform>`" → store creds → into chat |
| can't reach host | "Couldn't reach `<host>`. Is the API server running? (`hermes gateway`)" |
| reached, 401/403 | "Server's there, but the API key was rejected." |
| reached, wrong shape | "Reached something, but it doesn't look like Hermes. Check host/port." |

On success the user lands directly in an **empty chat** (just the composer — no first-run
hint or overlay). The same `unauthorized` result later drives the stale-key →
reconnect path.

**Status pill:** `running` while a response streams; `idle` otherwise; `error` on a
failed request or unreachable health ping. Richer background-run status arrives with the
runs API in slice 2.

**Feel: a messaging app, not a reinvented one.** Familiar chat patterns people already
know — input bar pinned above the keyboard, auto-scroll to newest, tap-to-copy, haptic
on send, native iOS font. **Hybrid layout:** user messages in a right-aligned bubble
(messaging feel); agent replies render **full-width with no bubble** so tables and code
have room to breathe (the Claude/ChatGPT pattern, and the whole point vs Telegram). No
reactions, threads, typing indicators, or custom theming — out of scope by design.

## 8. Testing

- **Unit:** the `markdown/` stabilization buffer against recorded SSE fixtures
  (the highest-value, trickiest logic).
- **Unit:** `hermes.ts` request building (headers, body shape) with a stubbed fetch.
- **Manual smoke:** full connect → chat → render flow against the live Hermes instance
  on a real device / simulator.

## 9. Slice 2 preview (not built yet)

Runs lifecycle for the headline "one-tap approve":
`POST /v1/runs` → `GET /v1/runs/{id}` (poll) / `GET /v1/runs/{id}/events` (SSE) →
`POST /v1/runs/{id}/approval` and `POST /v1/runs/{id}/stop`. Gated behind the
`run_approval` / `run_stop` flags from `/v1/capabilities`. Reuses the same agnostic UI
and the streaming renderer from this slice.

## 10. Risks / open items

- **SSE reliability on RN** — `react-native-sse` is the chosen lib; confirm it handles
  reconnect/partial frames in the first manual smoke test. Low residual risk.
- **Streaming markdown edge cases** beyond fences/tables (nested lists mid-stream) —
  acceptable to render slightly imperfectly until a fixture proves it matters.
- **Community validation & monetization** (PRD open decisions #3, #4, #6) — product
  questions, out of scope for this build slice.
