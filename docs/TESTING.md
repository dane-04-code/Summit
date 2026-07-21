# Testing Summit's agent delivery paths

> **Current V1 focus:** the Go connector loop below remains valuable compatibility coverage. The
> preferred Hermes path is the native platform plugin, so real-device release validation must cover
> that path as well: streamed text, safe activity, background/restart recovery, and one proactive
> cron result.

How to verify that chat, capabilities, and native features work across every
channel a user can arrive through — without owning a real Hermes, an Ollama
box, and a cloud relay all at once.

## The layers

| Layer | What guards it | Command |
|---|---|---|
| Adapters (Hermes, OpenAI-compat, relay) | Jest unit tests with a mocked SSE/WS transport | `npm test` |
| Framework detection (connect flow) | `__tests__/agents/connect.test.ts` | `npm test` |
| Connector (Go sidecar) | `go test ./...` in `/connector` — runs in CI on every push | `.github/workflows/release-connector.yml` |
| Live channels | The mock agent below | manual loops |

## The mock agent

`scripts/mock-agent.mjs` is a zero-dependency Node server that impersonates
either tier:

```bash
npm run mock:agent            # generic OpenAI-compatible (models + SSE chat), port 8642
npm run mock:hermes           # + /v1/capabilities, /health, Jobs API, runs, tool events
node scripts/mock-agent.mjs --hermes --key sk-test   # enforce Bearer auth (tests the 401 path)
node scripts/mock-agent.mjs --port 11434             # squat Ollama's port
```

It streams a markdown-rich canned reply in small SSE chunks (so the streaming
UI actually streams), emits a `hermes.tool.progress` event in Hermes mode, and
keeps real in-memory job state — pause/resume/run on the Cron screen visibly
change `/api/jobs`.

## Loop 1 — direct mode, generic agent

1. `npm run mock:agent`
2. App → pair screen → **Advanced / connect directly** → host `http://localhost:8642`, any key.
3. Expect: connects as an **OpenAI-compatible** agent, chat streams, and the
   sidebar has **no Cron Drops item** (capability-gated floor).

## Loop 2 — direct mode, Hermes

1. `npm run mock:hermes`
2. Connect screen → same host. Detection probes `/v1/capabilities` first, so
   this lands as **Hermes** with the full feature set.
3. Expect: tool chip ("Thinking about it") during the reply, Cron Drops in the
   sidebar, pause/resume actually flip the mock's job state.

## Loop 3 — relay channel, end to end

Exercises the full production path: app → Cloudflare relay → connector → agent.

**One command:**

```bash
npm run loop5          # mock Hermes + wrangler dev + connector, prints the code
```

`scripts/loop5.mjs` starts the mock agent, `wrangler dev` (relay on
`ws://localhost:8787`), and the connector, waits for the relay, and prints the
6-digit pairing code. Pair the app with it. Ctrl+C tears everything down.

Prefer the pieces by hand? Run them in three terminals:

1. `npm run mock:hermes`
2. `cd relay && npx wrangler dev --port 8787`
3. `node scripts/test-connector.mjs` (env `RELAY_URL`, `HERMES_BASE_URL`,
   `HERMES_API_KEY`, `AGENT_FRAMEWORK` — defaults suit the local mock)

> **Why a Node connector for testing?** The connector that ships is Go
> (`/connector`), but we only publish Linux/macOS binaries, and a Go toolchain
> isn't always around. `scripts/test-connector.mjs` is a dependency-free Node
> port that speaks the identical relay protocol, so Loop 3/5 run anywhere Node
> does. On a machine with Go, swap step 3 for `go run ./connector` to exercise
> the real binary.

For a **Tier 2 relay** agent, set `AGENT_FRAMEWORK=openai` — the connector
announces it in the `hello` frame, the app stores floor capabilities, and
Hermes-only UI stays hidden.

Without a phone, verify the pipe end to end:

```bash
node scripts/loop5-smoke.mjs        # pairs, registers a push token, round-trips a chat
```

## Loop 4 — real Tier 2 servers

Any of these should pass Loop 1 unchanged (they all serve `/v1/models` +
SSE `/v1/chat/completions`):

- Ollama — `ollama serve`, host `http://localhost:11434`, any key
- LM Studio — enable the local server, port 1234
- llama.cpp — `llama-server -m model.gguf`, port 8080

## Loop 5 — push notifications

### 5a — verify the push path without a phone

The relay only *decides* to push and POSTs to the Expo Push API. You can watch
that fire against a local sink instead of Expo:

1. `relay/.dev.vars` sets `PUSH_URL` to a local sink (already there; gitignored,
   never deployed — prod has no `PUSH_URL` and uses the real Expo API).
2. `npm run loop5` (the launcher picks up `.dev.vars`).
3. In another terminal: `node scripts/loop5-push-verify.mjs`

It pairs as the app, registers a token, leaves, then hits the connector's
`/notify` — and asserts the relay POSTs the notification to the sink. This is
the automated proof that agent → connector → relay → Expo Push API works.

### 5b — a real push on a device

Needs a **physical device** with a dev build (adding `expo-notifications`
changed the native side — rebuild the dev client once) and the iOS **APNs key**
set up (`eas credentials`). Two ways to point the phone at a relay:

- **Against the deployed relay (simplest):** `npm run loop5:cloud` runs the mock
  + connector dialing `wss://relay.summitapp.dev` (already live with push).
  Start Metro with `EXPO_PUBLIC_RELAY_URL=wss://relay.summitapp.dev npx expo start`
  so the dev build pairs through prod. The phone never needs to reach your PC.
- **Against a local relay:** `npm run loop5` and start Metro with
  `EXPO_PUBLIC_RELAY_URL=ws://<your-PC-LAN-IP>:8787` (not `localhost` — that's
  the phone itself).

Then:

1. Pair, accept the notification permission prompt.
2. Send a message, then **background the app before the reply finishes** — the
   socket drops, the `done` frame arrives with nobody watching, and the relay
   pushes "Hermes — Finished a reply".
3. Agent-initiated nudge, from the agent's machine:
   `curl -s localhost:8643/notify -d '{"title":"Approval needed","body":"Deploy to prod?"}'`
   Backgrounded → push; foregrounded → an in-band `notify` frame (no banner,
   you're already looking at the thread).
4. Token registration is idempotent: it re-registers at pair time and on every
   adapter reconnect, so a reinstalled app heals itself on next send.

### 5c — notification controls and notification taps

On a paired relay agent, open **Settings → Notifications** and verify each mode while the app is
backgrounded:

1. **All activity** (the default): finish a reply in a non-empty saved chat. One generic “Finished
   a reply” notification arrives. Tap it and confirm Summit opens that exact thread, not merely the
   most recent chat. The push carries only the opaque local session ID — never reply text.
2. **Needs attention:** a completed reply produces no notification; an approval request or agent
   error still does.
3. **Off:** neither replies nor attention events produce notifications.

Changing a mode reconnects the relay client so it takes effect immediately when the connector is
online; if it is offline, the saved mode applies on the next reconnect. Direct-mode agents remain
unable to notify a closed app by design.

Direct-mode agents can't push — nothing server-side sees their traffic when the
app is closed. That's inherent to direct mode, not a bug.

## What "working" means per capability

| Capability | Visible check |
|---|---|
| chat + streaming | reply renders progressively, stop button works |
| `hasJobs` | Cron Drops appears in the sidebar; absent for generic agents |
| `hasRunApproval` | approval cards render when the agent sends one |
| reconnect | kill the connector mid-session → badge shows disconnected → restart it → next send reconnects with the same code |
| push | background the app mid-reply → "finished a reply" push; `curl localhost:8643/notify` → agent nudge push |
