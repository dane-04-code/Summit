# Relay Connection — Design Spec

**Status:** Design | **Date:** 2026-06-28 | **Author:** Dane (+ Claude)
**Supersedes the "build later" framing of the relay in** `docs/CONNECTION.md` — this is the build.
**Sub-project of:** "the rest of the build" roadmap. This is **sub-project 3 (relay-first)**, and
within it, this spec scopes **slice 3a: the walking-skeleton spike.**

---

## 1. Why this exists (the one-breath version)

Make Summit work **like Telegram**: download the app, connect your agent in one paste,
reach it from anywhere on cellular — no host URL, no API key on the phone, nothing exposed on the
user's network.

Hermes is **inbound-only** — it cannot dial out (`FRAMEWORKS.md`, hard constraint). A phone on
cellular can't reach a home/VPS LAN. So, exactly like a self-hosted Telegram bot, **something must
run next to the agent and dial outbound to a cloud rendezvous.** That something is our **connector**;
the cloud rendezvous is our **relay**. This is not optional and there is no architecture that removes
it — if it could be removed, Telegram would have removed it too.

**Target environment (confirmed with Dane):** most Hermes/OpenClaw users run their agent on an
**always-on box — a VPS or a Mac Mini** — not a personal laptop. This means installing a real
background **service** (daemon) is appropriate and reliable.

**Product decision (confirmed with Dane):** we run **one hosted relay** (like Telegram's cloud).
The self-hostable / open-core relay idea is **dropped** — self-hosting a relay is friction we don't
want to push onto users. We host; users just connect.

---

## 2. The locked architecture

Three programs, two of which are new. Each runs in a different home, and the home dictates the
language — this is settled, not an open decision.

| Piece | Tech | Runs where | Job |
|---|---|---|---|
| **Connector** | **Go** (single static binary) | User's VPS / Mac Mini, next to Hermes | Dials out to the relay; holds the Hermes API key server-side; bridges `localhost:8642` |
| **Relay protocol** | **JSON over WebSocket** | (the wire) | The single shared language all three speak |
| **Relay** | **TypeScript on Cloudflare Workers + Durable Objects** | Our Cloudflare account | Pairs an app to a connector by 6-digit code; forwards frames; scales 1 → 10k with ~zero ops |
| **App** | TypeScript / React Native (already built) | The phone | Pairs with the code; talks WebSocket to the relay |

```
  Phone (app, TS)  ──WSS──►   Cloudflare Relay   ◄──WSS──  Connector (Go binary)
                              Workers + Durable               on the VPS / Mac Mini
   holds: device token        Objects (TS)                    holds: Hermes API key
   (no Hermes key)            pairs by 6-digit code           talks to localhost:8642
```

**Why Go for the connector:** it installs on *other people's* machines, so the priority is a
one-paste install with zero prerequisites. A single self-contained binary (the model Tailscale and
`cloudflared` use) delivers that; cross-compiles to the three real targets: `linux/amd64`,
`linux/arm64`, `darwin/arm64`.

**Why Cloudflare Durable Objects for the relay:** the hardest problem in a relay is that the phone
and the connector connect *separately* and must find each other. A Durable Object solves this for
free — a pairing code maps to exactly **one** object that both sides connect to, routed together
globally by Cloudflare. WebSocket **Hibernation** makes thousands of mostly-idle connectors nearly
free. It's TypeScript, so the relay shares protocol types with the app. Push (APNs) later goes out
from the same Worker. Trade-off accepted: Cloudflare dependency — fine, because we are deliberately
**not** offering a self-host relay.

---

## 3. The protocol (JSON over WebSocket)

One envelope, a small set of typed frames. This is the contract between all three programs; getting
it right is the durable asset. Every frame is a JSON object with a `t` (type) discriminator.

**Pairing & lifecycle**

| Direction | `t` | Payload | Meaning |
|---|---|---|---|
| connector → relay | `hello` | `{ framework, agentName, agentVersion }` | Connector registers after dialing in |
| relay → connector | `code` | `{ code }` | Relay assigns a 6-digit pairing code; connector prints it |
| app → relay | `pair` | `{ code }` | App submits the code the user typed |
| relay → app | `paired` | `{ framework, agentName, agentVersion }` | Bind succeeded; capabilities echoed back |
| relay → app | `pair_error` | `{ reason }` | `not_found` \| `expired` \| `already_paired` |
| relay → both | `peer_gone` | `{}` | The other side disconnected |

**Chat (the spike's proof)**

| Direction | `t` | Payload | Meaning |
|---|---|---|---|
| app → relay → connector | `chat` | `{ reqId, messages }` | A chat turn (OpenAI-shape `messages`) |
| connector → relay → app | `chunk` | `{ reqId, delta }` | A streamed token delta (from Hermes SSE) |
| connector → relay → app | `done` | `{ reqId }` | Turn complete |
| connector → relay → app | `error` | `{ reqId?, message }` | Upstream/connector failure |

The relay **forwards `chat`/`chunk`/`done`/`error` opaquely** — it does not parse chat content. It
only understands `hello`/`code`/`pair`/`paired`. This keeps the relay thin and means new capabilities
(approve/stop, status, jobs) are added later **without relay changes** — they ride the same
forward-the-frame mechanism.

---

## 4. Scope — slice 3a: the walking-skeleton spike

**Goal:** prove the entire chain works end-to-end with the smallest possible build. This is the PRD's
own "Immediate Next Step #3." When it's green, the architecture is de-risked and everything else is
additive.

**The proof:** paste-run the connector → it dials the Cloudflare relay → prints a 6-digit code →
enter the code in the app → app shows "Connected to Hermes vX" → type a message → a **real Hermes
reply streams back token-by-token** through connector → relay → app.

**IN scope for 3a:**

- **Connector (Go):** foreground process; reads `HERMES_BASE_URL`, `HERMES_API_KEY`, `RELAY_URL`
  from env; dials relay over WSS; sends `hello`; prints the `code`; on `chat`, calls
  `POST {HERMES_BASE_URL}/v1/chat/completions` with `stream:true`, translates Hermes SSE
  (`chat.completion.chunk`) into `chunk` frames, ends with `done`.
- **Relay (CF Worker + DO):** WS upgrade in the Worker; a `PairingChannel` Durable Object **named by
  the 6-digit code**; pairing handshake; bidirectional frame forwarding using the Hibernation API;
  `peer_gone` on disconnect.
- **App:** a `RelayClient` (WS) + a relay-backed adapter selected when `agent.transport === 'relay'`
  (the data model already has this field); a **pairing screen** (6-digit entry) that, on `paired`,
  writes a `relay` `Agent` row (`base_url: null`) via the existing repository and stores a device
  token in Keychain via existing `secrets.ts`; minimal wiring of the chat composer to stream a real
  reply through the relay adapter (replacing the stub stream **for relay agents only**).

**Acceptance criteria (how we know 3a is done):**

1. `wrangler dev` runs the relay locally; connector connects and prints a code.
2. App pairs with that code and displays the real agent name/version.
3. A message typed in the app produces a **real, streaming** Hermes reply rendered in the thread.
4. Killing the connector shows the app a `peer_gone`-driven disconnected state (no crash).
5. Relay + connector + app unit tests pass; `npx tsc --noEmit` + `npm test` stay green for the app.

---

## 5. Explicitly OUT of scope (deferred — and where they go)

| Deferred item | Slice |
|---|---|
| `curl \| sh` install endpoint, framework detection, daemonization (systemd/launchd), reading key from `~/.hermes/.env`, the copyable agent-assisted prompt | **3b** |
| Persistent **device tokens** + reconnection across restarts; a `code → agent` directory; pairing-code **expiry / single-use / rate-limit**; relay auth hardening; production Cloudflare deploy & custom domain | **3c** |
| **Push notifications** via APNs from the Worker | **3d** |
| Approve/stop, status polling, jobs **over the relay** (trivial once chat works — same frame mechanism) | fast-follow after 3a |
| Supabase **account** ↔ relay identity linkage | later (after 3c) |
| Full markdown **parsing** of streamed text, transcript **persistence**, real status indicator | **sub-project 1** ("make the app real") — the spike streams plain text into the existing message model only |
| OpenClaw connector/adapter | v2 |

For the spike, the **6-digit code names the Durable Object** and a session is single-use: if the app
restarts, you re-pair. Persistent tokens + reconnection are the first items of 3c; the protocol
reserves room for a token so adding it is additive, not a rewrite.

---

## 6. Component designs

### 6.1 Connector (Go) — `/connector`

- `main.go`: load env config; connect WSS to `RELAY_URL`; send `hello`; print received `code`;
  read loop dispatching frames.
- `hermes.go`: `streamChat(messages) -> <-chan frame` — POSTs to `/v1/chat/completions` with
  `stream:true`, parses the SSE line protocol, emits `chunk` frames, then `done`; emits `error` on
  failure. Uses only the stdlib `net/http` + `bufio` SSE parse + `gorilla/websocket` (or
  `nhooyr.io/websocket`) for the relay socket.
- Reconnect/backoff to the relay is **3c**; spike assumes a stable dev connection.
- **Tests:** SSE→frame translation against a stub HTTP server; frame round-trip against a stub WS.

### 6.2 Relay (Cloudflare Worker + Durable Object) — `/relay`

Standalone npm project (`/relay/package.json`, `/relay/wrangler.toml`) — independent of the app's
tooling.

- **Worker (`src/index.ts`):** on WS upgrade, route to the `PairingChannel` DO.
  - Connector path (no code yet): mint a random unused 6-digit code → `idFromName(code)` → forward
    the upgrade into that DO as the *connector* socket.
  - App path (`?code=NNNNNN`): `idFromName(code)` → forward the upgrade as the *app* socket.
- **`PairingChannel` DO (`src/channel.ts`):** holds at most one connector socket + one app socket.
  Uses `state.acceptWebSocket()` (Hibernation API) and `webSocketMessage` / `webSocketClose`.
  Handles `hello`→`code`, `pair`→`paired`/`pair_error`, and forwards everything else to the peer;
  emits `peer_gone` on close.
- **Collision handling (spike):** ask the DO whether a code is occupied; retry on the ~nil chance of
  a clash. Expiry/single-use is 3c.
- **Tests:** `vitest` + `@cloudflare/vitest-pool-workers` (miniflare) — pairing handshake, forwarding,
  peer-gone, wrong-code error.

### 6.3 App (React Native) — fits the existing model

The data model already supports this: `agents.transport` is `'direct' | 'relay'`, and the documented
rule (`docs/AGENTS.md` §2/§4) is that a relay agent's Keychain secret is a **device token**, not the
Hermes key. The spike implements the relay side of that existing design.

- `src/agents/relay/client.ts` — `RelayClient`: opens the WS to the relay, exposes pairing
  (`pair(code)`) and a `chat(messages)` async iterable of stream events.
- `src/agents/adapters/relay.ts` — `RelayAdapter implements AgentAdapter`: `sendMessage` drives
  `RelayClient.chat`; other methods are stubbed/`peer_gone`-aware for the spike. Wire into
  `makeAdapter()` so `transport === 'relay'` selects it.
- `src/app/(app)/pair.tsx` — 6-digit entry screen; on `paired`, create the `Agent` row + store the
  device token, set active agent, route to chat. (The agent-assisted prompt UI is 3b; spike shows a
  plain code field.)
- Chat screen: when the active agent is `relay`, route `handleSend` through the adapter instead of
  the stub. Direct-mode/stub path is untouched.

---

## 7. Data flow

**Pairing**
1. Connector dials relay WSS → Worker mints code `481920` → routes connector into DO `481920`.
2. DO receives `hello`, replies `code {481920}`; connector prints it; user's agent relays it (3b) or
   user reads it from the terminal (spike).
3. App opens WSS `?code=481920` → Worker routes app into DO `481920`.
4. App sends `pair {481920}` → DO has a connector → replies `paired {agentName, version}` → app lands
   in chat. (Wrong/stale code → `pair_error`.)

**Chat round-trip**
1. App → `chat {reqId, messages}` → relay forwards to connector.
2. Connector → Hermes `POST /v1/chat/completions stream:true`.
3. Hermes SSE `chat.completion.chunk` → connector emits `chunk {reqId, delta}` per token → relay
   forwards to app → app appends to the streaming message.
4. Stream ends → connector `done {reqId}` → app finalizes the message.

---

## 8. Repo layout (monorepo, app stays at root)

```
/                 existing Expo app (src/, app.json, package.json, jest, tsc)
/relay/           Cloudflare Worker + DO — own package.json, wrangler.toml, vitest
/connector/       Go module — go.mod, main.go, hermes.go
/protocol/        protocol.md (frame reference) + protocol.ts (shared TS types for app + relay)
```

Setup task: exclude `/relay`, `/connector`, `/protocol` from the **root** `tsconfig` and `jest`
config so the app's green bar doesn't try to compile the relay or the Go module. `/relay` runs its
own `tsc`/`vitest`; the connector runs `go test`.

---

## 9. Error handling

- **Connector can't reach Hermes** → `error {reqId, message}` to the app; app shows an inline error,
  no crash.
- **Connector or app disconnects** → DO emits `peer_gone`; the surviving side shows a disconnected
  banner. (Auto-reconnect is 3c.)
- **Wrong / stale code** → `pair_error {reason}`; pairing screen shows a friendly message and lets the
  user retype.
- **Malformed frame** → ignored + logged at the relay; never throws across the socket.

---

## 10. Risks & open questions (resolve during build)

| # | Item | Note |
|---|---|---|
| 1 | DO hibernation + long-lived connector sockets | The connector holds a persistent WS; confirm Hibernation keep-alive/ping behavior so idle connectors aren't dropped. Spike validates this directly. |
| 2 | 6-digit code as DO name (spike only) | Acceptable for the spike; **must** become code→agent indirection + expiry/single-use/rate-limit in 3c before any real exposure. |
| 3 | Cloudflare account / `wrangler` setup | One-time: CF account, `wrangler login`, DO migration in `wrangler.toml`. |
| 4 | Go in the repo's tooling/CI | Connector needs its own `go test` lane; keep it out of the Expo/jest green bar. |
| 5 | Hermes SSE shape | Translate `chat.completion.chunk`; `hermes.tool.progress` is non-persisted and out of spike scope (`hermes-expert`). |

---

## 11. After the spike — the rest of relay-first

3a (this) proves the pipe → **3b** agent-assisted install (`curl | sh`, daemonize, framework detect,
the prompt) → **3c** tokens, reconnection, pairing-code security, production deploy → **3d** push via
APNs. Then sub-project 1 ("make the app real": markdown parsing, persistence, status, approve/stop,
cron) layers cleanly on top, since those all ride the same relay frames.
