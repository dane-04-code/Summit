# Wiring the UI to the agent backend — design

**Status:** Design (approved verbally, pending written review) · **Date:** 2026-06-28 · **Branch:** `build/first-pages`

## 1. Goal & context

The agent backend (`src/agents/`, `src/db/`) is built and tested — `useAgents()` exposes
`addAgent / activeAgent / adapterFor / repo`, the `HermesAdapter` does the real capabilities probe +
SSE streaming + approve/stop, and the `Repository` persists agents/sessions/messages. But the **UI
still runs entirely on seed data and a fake stream** (`.sdd/progress.md`: _"Not yet wired into chat
screen (stub stream remains)"_). Critically, the old direct-mode Connect screen was deleted in the
route restructure, so **after sign-in you land in chat with no agent and no way to add one**.

This project bridges UI ↔ backend so the app works end-to-end against a real Hermes server: add an
agent, chat with live streaming, persist history, approve/stop runs, manage settings, and drive cron
drops from the Jobs API.

**Source-of-truth docs this builds on:** `docs/AGENTS.md` (storage/persistence contract),
`FRAMEWORKS.md` (Hermes API surface + hard constraints), `DESIGN_SYSTEM.md` / `src/theme.ts` (visual
tokens). Nothing here changes those contracts; it consumes them.

**Test target:** a live Hermes (host:8642 + API key) is available on demand, so each slice is verified
end-to-end against a real server, not just unit tests.

## 2. The core architectural decision — live turns flow through the Runs API

A chat turn can take one of two Hermes paths, and the choice decides whether approvals are possible:

- **`POST /v1/chat/completions` (what the adapter does today)** — simple SSE: `chat.completion.chunk`
  deltas + `hermes.tool.progress`. **This path cannot pause for approval** — there is no approval
  concept in chat-completions. The ApprovalCard could never become real on this path.
- **Runs API (`POST /v1/runs` → `GET /v1/runs/{id}/events` SSE → `POST /v1/runs/{id}/approval` /
  `…/stop`)** — Hermes' headline feature. One stream carries token deltas, tool progress, **and**
  approval-pending + lifecycle events, and yields a real `run_id` to target Stop/Approve.

**Decision:** the live turn flows through the **Runs API when the server advertises it**
(`run_submission` + `run_events_sse` in `/v1/capabilities`), with `/v1/chat/completions` kept as the
fallback for older Hermes builds. **Local SQLite remains the source of truth for history** (per
`docs/AGENTS.md`); we do not adopt server-side sessions. Session continuity still rides the
`X-Hermes-Session-Id` / `X-Hermes-Session-Key` headers (Honcho memory).

**Rationale:** this is the only path that unlocks the app's headline differentiator (one-tap
approve/stop from the phone) without rewriting the local-first persistence model.

**Known risk / open assumption:** `FRAMEWORKS.md` documents the Runs endpoints but **not the exact
approval-pending event payload** on `/v1/runs/{id}/events`. Mitigation: isolate event parsing in a
single pure function (`parseRunEvent`) with unit tests, and confirm the wire shape against the live
Hermes during Slice 3. If the shape proves unstable, the fallback is to ship chat on the Runs path
*without* the approval branch and layer approval in once confirmed — the rest of the slice is
unaffected.

## 3. Normalized stream events (the seam everything renders from)

`StreamEvent` (in `src/agents/adapters/types.ts`) grows two variants so the screen never branches on
framework or transport:

```ts
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'run'; runId: string }                                  // NEW — active run id for stop/approve
  | { type: 'approval'; runId: string; title: string; command: string } // NEW — render ApprovalCard
  | { type: 'done' }
  | { type: 'error'; message: string };
```

The screen accumulates `delta` text into one agent `markdown` block, shows `tool` labels as the
running hint, records the `runId` from `run`, renders an `ApprovalCard` on `approval`, and settles +
persists on `done`. This keeps the UI identical whether the turn ran via chat-completions or the Runs
API.

## 4. The slices

Six independently-shippable slices, ordered by dependency. **Each ends with `npx tsc --noEmit` +
`npm test` green** (the project's green bar) and is usable on its own.

### Slice 0 — Connect screen + no-agent gate *(the unblocker)*

- **New route** `src/app/(app)/connect.tsx`. Direct mode only (relay throws today). Fields: **Name**
  (default "Hermes"), **Host** (`host:port`), **API key**. Design-system faithful — reuse the
  sign-up patterns (brand mark, labeled inputs, ink primary button, theme tokens only).
- **Test before save:** build a transient `Agent`, call
  `makeAdapter(agent, () => Promise.resolve(key)).testConnection()`. Map `ConnectionError.kind`
  (`unreachable` / `unauthorized` / `wrong-shape` / `server-error`) to specific inline messages.
- **On success:** `addAgent({ name, framework:'hermes', transport:'direct', baseUrl, capabilities }, key)`
  (capabilities = the `testConnection` snapshot), then navigate to chat.
- **Gate:** in `src/app/(app)/_layout.tsx`, add an `AgentGuard` (mirroring `RouteGuard`): when
  `ready && !activeAgent` and not already on `connect`, redirect to `/(app)/connect`. Register the
  `connect` screen on the Stack (`headerShown:false`).
- **Acceptance:** fresh install → sign in → forced to Connect → enter live host+key → land in chat
  with a persisted agent that survives app restart.

### Slice 1 — Live chat wired to the active agent *(the core loop)*

- Replace `SEED_THREAD` + the `setInterval` stub in `src/app/(app)/index.tsx`.
- **On mount:** resolve the active session for `activeAgent` (most-recent via `repo.listSessions`, or
  an empty new thread). Load its messages with `repo.listMessages` → `Message[]`.
- **On send:** ensure a `ChatSession` exists (create on first message: `repo.upsertSession` with a
  generated `remoteSessionKey`); append the user `StoredMessage`; open
  `adapterFor(activeAgent).sendMessage(text, { sessionId, sessionKey })`; accumulate `delta`s into a
  live agent `markdown` block in React state; map `tool` → running hint; drive `Header` status from
  events. **On `done`, persist the settled agent message** (`repo.appendMessage`) and bump
  `session.updatedAt`. `error` → error status + inline error message (no persisted partial).
- **Persistence rule (from `docs/AGENTS.md` §7):** persist the settled message, not every delta;
  mid-stream tokens stay in React state.
- **Acceptance:** send a message to live Hermes, watch it stream, kill+reopen the app → the thread is
  still there.

### Slice 2 — Sidebar history + account *(real sessions)*

- Build `ChatGroup[]` from `repo.listSessions(activeAgent.id)`, grouped by date
  (Today / Yesterday / older) → `ChatSummary` (title, preview, relative time, last run-state dot).
- **Account** `{ name, initial }` from the Supabase user (`useAuth()` → email or
  `user_metadata.name`).
- New chat → create + switch session; select chat → load its messages; `activeId` = current session.
- **Titles:** derived from the first user message (truncated). Agent-generated titles are out of scope
  (YAGNI) for this plan.
- **Acceptance:** multiple real conversations appear grouped and switchable; the footer shows the
  real signed-in account.

### Slice 3 — Approvals + Stop (Runs API) *(the headline)*

- **Adapter:** implement the Runs-API `sendMessage` path (gated on
  `capabilities` Runs flags); add `parseRunEvent` (tested, isolated). `approveRun` / `stopRun` already
  exist on `HermesAdapter`. Track the active `runId` from the `run` event.
- **Screen:** render `ApprovalCard` inline on an `approval` event; wire Approve/Deny to
  `adapter.approveRun(runId, bool)` and the composer Stop to `adapter.stopRun(runId)` while streaming.
  **Gate the approve UI on `activeAgent.capabilities.hasRunApproval`** (never show unconditionally —
  `FRAMEWORKS.md` constraint).
- **Confirm** the approval event shape against live Hermes; finalize `parseRunEvent`.
- **Acceptance:** trigger an approval-gated tool on live Hermes → ApprovalCard appears → Approve
  resumes the run, Deny/Stop halts it.

### Slice 4 — Settings *(real)*

- Replace the placeholder `settings.tsx`: show account (email/name), active agent (name, host,
  server version + capability summary), **Sign out** (`useAuth().signOut`), **Remove agent**
  (`useAgents().removeAgent` → returns to Connect via the gate), and **Add / switch agent** (minimal —
  the registry already supports multiple; no multi-agent polling).
- **Acceptance:** sign out returns to auth; remove agent returns to Connect; switching agents repoints
  the chat.

### Slice 5 — Cron Drops (Jobs API)

- **Adapter:** add job methods — `listJobs / getJob / pauseJob / resumeJob / triggerJob` — against
  `/api/jobs`. Map the response to the existing `CronJob` UI type (already shaped for `/api/jobs` in
  `src/ui/cron/types.ts`).
- **Screen:** `cron.tsx` loads real jobs; `CronDetail` actions call pause/resume/run-now. The live
  per-step trace reuses Slice 3's run-events machinery (a triggered run streams `tool.*` events);
  past per-step history stays absent (Hermes doesn't persist it — documented in `cron/types.ts`).
- **Availability:** `/api/jobs` is **not** advertised in `/v1/capabilities`, so probe it (a `GET`
  that 404s → hide the Cron entry) rather than assuming presence.
- **Acceptance:** real scheduled jobs list with correct status badges; pause/resume/run-now work
  against live Hermes.

## 5. Cross-cutting cleanups

- **Capabilities mapping:** `hermes.ts` currently maps `run_submission` → `hasJobs`, conflating the
  **Runs API** (`/v1/runs`, advertised) with the **Jobs API** (`/api/jobs`, not advertised). Split
  these: Runs availability comes from `run_submission`/`run_events_sse`; Jobs availability comes from
  the Slice 5 probe. Adjust `AgentCapabilities` if needed.
- **Tests per slice:** connect error mapping, `parseRunEvent`, jobs→`CronJob` mapper, session→
  `ChatGroup` grouping. Keep `tsc` + `jest` green at each slice boundary.

## 6. Error handling

- **Connect:** typed `ConnectionError` → specific inline copy; never a generic failure.
- **Chat stream:** `error` event → header `error` state + inline message; the composer stays usable;
  no half-written message is persisted.
- **Approvals:** a failed approve/stop surfaces inline and leaves the run resumable.
- **Rehydrate failure** is already handled by `AgentProvider` (starts empty; user re-adds) — unchanged.

## 7. Out of scope (tracked elsewhere / deferred)

- **Relay transport + connector sidecar** (`docs/CONNECTION.md`) — direct mode only here; the model
  already reserves space for relay.
- **OpenClaw real adapter** — stays a stub; needs its own research pass (`FRAMEWORKS.md`).
- **File upload** — Hermes is inline-images-only; not built.
- **Agent-generated chat titles**, **multi-agent background polling** — YAGNI for this plan.

## 8. Definition of done

All six slices merged, each green on `tsc` + `jest`, and the full loop verified against a live
Hermes: **sign in → connect an agent → chat with streaming → history persists across restart →
approve/stop a run → manage settings → drive a cron job.**
