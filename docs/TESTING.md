# Testing the multi-agent connection

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

1. `npm run mock:hermes` (the connector thinks it's Hermes)
2. In `/relay`: `npx wrangler dev` (relay on `ws://localhost:8787`)
3. Run the connector against both:
   `RELAY_URL=ws://localhost:8787 HERMES_BASE_URL=http://localhost:8642 HERMES_API_KEY=x go run ./connector`
4. Pair the app with the printed 6-digit code.
5. Expect: chat streams over the relay; jobs + approval proxy through the
   connector's allow-list.

For a **Tier 2 relay** agent, add `AGENT_FRAMEWORK=openai` to step 3 — the
connector announces it in the `hello` frame, the app stores floor
capabilities, and Hermes-only UI stays hidden.

## Loop 4 — real Tier 2 servers

Any of these should pass Loop 1 unchanged (they all serve `/v1/models` +
SSE `/v1/chat/completions`):

- Ollama — `ollama serve`, host `http://localhost:11434`, any key
- LM Studio — enable the local server, port 1234
- llama.cpp — `llama-server -m model.gguf`, port 8080

## Loop 5 — push notifications

Push needs a **physical device** with a dev build (adding `expo-notifications`
changed the native side — rebuild the dev client once). The relay sends the
pushes; the mock agent plays the upstream.

1. Run Loop 3 (mock Hermes + local relay + connector), pair the app on a real
   device, accept the notification permission prompt.
2. Send a message, then **background the app before the reply finishes** —
   the app socket drops, the `done` frame arrives with nobody watching, and
   the relay pushes "Hermes — Finished a reply".
3. Agent-initiated nudge, from the agent's machine:
   `curl -s localhost:8643/notify -d '{"title":"Approval needed","body":"Deploy to prod?"}'`
   With the app backgrounded that lands as a push; with it foregrounded it
   arrives as an in-band `notify` frame instead (no banner — you're already
   looking at the thread).
4. Token registration is idempotent: it re-registers at pair time and on
   every adapter reconnect, so a reinstalled app heals itself on next send.

Direct-mode agents can't push — nothing server-side sees their traffic when
the app is closed. That's inherent to direct mode, not a bug.

## What "working" means per capability

| Capability | Visible check |
|---|---|
| chat + streaming | reply renders progressively, stop button works |
| `hasJobs` | Cron Drops appears in the sidebar; absent for generic agents |
| `hasRunApproval` | approval cards render when the agent sends one |
| reconnect | kill the connector mid-session → badge shows disconnected → restart it → next send reconnects with the same code |
| push | background the app mid-reply → "finished a reply" push; `curl localhost:8643/notify` → agent nudge push |
