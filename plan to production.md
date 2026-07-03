# Summit App Plan To Production

Last updated: 2026-07-01

This plan is for the Expo mobile app only. The marketing website is a separate codebase and should
not be allowed to blur the remaining app work.

## Current State

- Expo app shell is running with auth-gated routes.
- Supabase auth exists. Email sign-in/sign-up screens exist; production signup is UI-gated by
  `SIGNUP_ENABLED`.
- Agent persistence exists: SQLite stores agent/session/message metadata, Keychain stores one
  secret per agent.
- Direct Hermes adapter exists for chat, capabilities, run approval/stop, and jobs API calls.
- Relay pairing works with Hermes through the Cloudflare relay plus Go connector walking skeleton.
- Relay client now keeps the WebSocket alive with app-level heartbeats and can re-pair after a
  reconnect using the saved pairing code.
- Connector saves its pairing code in `~/.summit/pairing_code` and reconnects with a claim.
- Chat screen streams real adapter output, persists completed turns, and restores the newest thread.
- Markdown rendering exists for headings, lists, tables, code, math-ish rich text, copied markdown
  documents, and code copy.
- Cron tab UI loads jobs through the adapter in both direct and relay mode. Relay job and
  run-approval calls ride an allow-listed `api_req`/`api_res` proxy through the connector.
- The chat sidebar is wired to real saved sessions grouped by day; the `seed.ts` recents
  (`RECENT_CHATS`/`ACTIVE_CHAT_ID`) are now orphaned.
- OpenClaw is still a stub and needs a separate research pass before implementation.
- Loading and error states exist in places, but they are not yet consistent enough for production —
  most notably the pair screen still surfaces generic "WebSocket error" messages.

## Product Target

Summit is a mobile cockpit for a self-hosted agent. The MVP should feel like:

1. Sign in.
2. Pair your Hermes agent with a 6-digit code.
3. Chat with stable streaming and rich output.
4. Reopen the app and everything is still there.
5. Check scheduled jobs without the tunnel dropping.
6. See clear loading/error states whenever anything is unavailable.

Anything that does not improve this flow is later.

## MVP Blockers

### 1. Relay Reliability

Goal: pairing and chat stay alive through normal mobile/relay/connector interruptions.

- Soak-test pairing with Hermes: app restart, connector restart, relay restart, background/foreground,
  wrong code, duplicate app, connector dies mid-stream.
- Fix any cases where `peer_gone`, reconnect, or re-pair leaves the app stuck.
- [x] Make relay/client errors user-readable: `RelayClient` now throws typed `RelayError`s
      (`relay_unreachable`, `code_not_found`, `code_expired`, `already_paired`, `agent_disconnected`)
      with plain-language copy from `src/agents/relay/errors.ts`; the pair screen shows the message
      and only flags the code field when the code itself is the problem.
- Decide whether the current pairing code-as-device-token is acceptable for beta, or whether a real
  persistent device token is required before external testing.

### 2. Cron Jobs Over Relay — DONE (`c1db0a2`)

Built more simply than first planned: instead of per-verb `jobs.*` frames, jobs and run
approval/stop ride a generic allow-listed `api_req`/`api_res` proxy through the connector.

- [x] Connector allow-lists the job paths (`GET /api/jobs`, `GET /api/jobs/{id}`,
      `POST /api/jobs/{id}/(run|pause|resume)`) as the trust boundary — `connector/hermes.go`.
- [x] Relay adapter implements every job method through the proxy instead of rejecting — `relay.ts`.
- [x] `RelayClient.request()` uses unique request IDs and a 15s timeout, so a stuck job cannot
      poison chat streaming.
- [x] Cron UI refreshes after pause/resume/run and shows last-run output in the detail view.
- [x] Tests: connector allow-list (`connector/api_test.go`), job parsing
      (`__tests__/agents/relay/jobs.test.ts`), cron screen (`__tests__/cron.test.ts`).
- [ ] Still worth a manual soak: cron while a chat stream is running and while a connector reconnects.

### 3. Conversation Continuity

Goal: the app keeps the conversation understandable across restarts and long sessions.

- Confirm Hermes session headers are correct for relay and direct.
- Decide the right session identity:
  app session id for a thread, stable session key for memory, and device identity for relay.
- Restore latest session on app open, which is mostly built.
- [x] Sidebar wired to real sessions instead of empty/seed groups (`loadSessionSummaries` in
      `src/app/(app)/index.tsx`; `seed.ts` recents now dead).
- Add new chat, select chat, delete chat if needed for beta. New chat and select chat are wired;
  delete chat is not.
- Persist error turns or intentionally do not persist them; make the behavior consistent.

### 4. Rich Output Polish

Goal: output looks first-class for the real things Hermes sends.

- [x] Add fixtures/tests for the exact output shapes we care about — `__tests__/fixtures/markdown.ts`
      (wide table, nested lists, unbreakable URL, wide code, mixed doc, huge doc) driven through the
      real renderer by `__tests__/markdownRender.test.tsx`.
- [x] Improve table behavior when wide columns overflow — wide tables now scroll horizontally
      (`table` render rule in `richMarkdown.tsx`) instead of clipping/squishing; `CodeBlock` already
      scrolls long lines.
- Keep code snippets as-is if testing confirms they hold up.
- Still to test: nested lists, links, headings, partial markdown while streaming, pasted `.md`
  files, and very long responses — visually, on-device.
- Verify graph output expectation. If "graphs" means markdown/image output from Hermes, render that;
  if it means custom charts, define the minimal supported JSON/markdown shape before building.

### 5. Auth, Loading, And Error Screens

Goal: no route feels broken or blank.

- Finish production login polish: loading session, invalid credentials, network failure, sign out,
  disabled signup path, Apple/Google decision.
- Add an app boot/loading screen while auth and agents rehydrate.
- Add no-agent state that sends users to pair/connect.
- Add connection-lost state in chat without destroying the transcript.
- Add settings actions: sign out, remove agent, repair/re-pair agent, clear local data.

### 6. OpenClaw Later, Not In The Hermes MVP

Goal: avoid mixing an unresearched framework into the current MVP.

- Test OpenClaw manually only to learn the shape.
- Do not promise parity with Hermes until the adapter research is complete.
- Create a separate OpenClaw plan after Hermes relay, cron, persistence, and auth are stable.

## Execution Order

### Pass 1: Stabilize The Tunnel

- Run the Hermes pairing QA matrix.
- Fix reconnect/re-pair bugs.
- Make connection errors readable.
- Add or update tests around `RelayClient`, relay logic, and connector concurrent writes.

Exit gate: paired Hermes can chat after app restart and connector restart without redoing setup.

### Pass 2: Make Cron Work Through The Same Tunnel — DONE

- [x] Relay adapter + connector proxy job calls over the tunnel (generic `api_req`/`api_res`).
- [x] Job requests isolated from chat streams with request IDs + a 15s timeout.
- [x] Tests cover job response parsing and the connector allow-list.

Exit gate met: cron tab loads, opens a job, runs a job, pauses/resumes a job over relay.

### Pass 3: Finish Real App Persistence — MOSTLY DONE

- [x] Wire sidebar to real sessions.
- [x] Confirm latest chat restore (restores newest thread on open).
- Add no-agent and failed-rehydrate states.
- Verify SQLite has no secrets and Keychain has only the agent secret/device token.

Exit gate: fresh app launch, signed-in app launch, restart after chat, and delete/re-add agent all
behave predictably.

### Pass 4: Polish Output

- Test markdown fixtures against the UI.
- Fix wide table/long text overflow.
- Confirm code copy, markdown file cards, links, and long streaming output.
- Define graph support narrowly and implement only if Hermes produces a real format we can render.

Exit gate: real Hermes outputs look good enough to screen-record.

### Pass 5: Auth And Production States

- Finish sign-in/sign-up decisions.
- Add boot, loading, empty, and error states across auth, pair, chat, cron, settings.
- Add settings management.

Exit gate: no blank screens, no fake data, no unclear failure messages.

## Manual QA Matrix

- Fresh install.
- Sign in.
- Sign out.
- App restart while signed in.
- Pair Hermes by code.
- Wrong pairing code.
- Connector offline during pair.
- Send a normal chat message.
- Send markdown-heavy prompt.
- Send long code/table prompt.
- Background and foreground app during stream.
- Kill connector during stream.
- Restart connector and send again.
- Open cron tab over relay.
- Run a cron job over relay.
- Pause/resume cron job over relay.
- Restart app and confirm chat/session still exists.
- Remove agent and confirm local data/secret are gone.

## Near-Term Non-Goals

- Website work.
- RevenueCat.
- Public store metadata.
- Push notifications.
- OpenClaw production adapter.
- Arbitrary custom charting unless Hermes produces a stable output format.

## Next Action

Cron-over-relay (Pass 2), the real-session sidebar (Pass 3), and **pair-screen error states**
(Pass 1 / Frontend Pages #1) are done; the suite is green (`tsc --noEmit` + `npm test`, 104 passing).
`RelayClient` now classifies pairing failures into typed `RelayError`s with user-readable copy, and
the pair screen surfaces them.

The remaining Pass 1 work is **verification, not code**: run the pairing QA matrix against a real
Hermes + relay (app restart, connector restart, relay restart, background/foreground, wrong code,
duplicate app, connector dies mid-stream) and confirm each failure now shows the right message and
recovers. Fix any reconnect/re-pair case that leaves the app stuck. After that, move to Pass 4
(rich-output polish) and Pass 5 (auth/production states + settings actions).
