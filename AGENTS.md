# Agents: Product, Connection, Storage & Persistence

**Status:** iOS production build 13 finished and is processing for TestFlight; app + relay delivery
built; native Hermes plugin alpha implemented and under real-device validation | Last updated 2026-07-21

How an agent (Hermes today, OpenClaw later, anything else after) gets **added**, **connected**,
**stored on the phone**, and **kept alive across app restarts** — including saved chat history.

This is the structural contract. Read it before touching `src/agents/` or `src/db/`. It is grounded
in `FRAMEWORKS.md` (API surfaces + hard constraints) and `docs/CONNECTION.md` (relay vs direct).

---

## 0. Product and delivery state — read this first

**Summit is a mobile operator cockpit for a self-hosted agent, not a generic chat client.** The
product is the fluent loop: pair the agent, message it from away from the desk, see safe operational
activity, receive a privacy-safe notification when it needs attention, and act on a decision. Rich
markdown is important presentation, but it is not the product by itself.

### What is real today

- The iOS app has account onboarding, relay pairing, saved sessions, streamed chat, native markdown,
  status/activity, settings, and notification plumbing. Production build 13 has finished; confirm its
  App Store Connect/TestFlight processing and complete physical-device validation before release.
- `../Summit-Hermes/` is a separate Git working copy for the **native Hermes platform plugin**. It
  is not merely a future design: its alpha implements native Hermes session routing, draft streaming,
  safe live tool activity, reconnect, and a durable acknowledged reply outbox. It talks to the same
  Summit relay without a local HTTP/API-key bridge.
- `connector/` remains a working Go compatibility fallback (and the current OpenClaw bridge). It is
  not the preferred Hermes onboarding path once the native plugin passes beta proof.
- `../summit-openclaw/` contains the native OpenClaw channel foundation, but it must not be presented
  as equivalent live chat support yet: public SDK-backed dispatch, finalization, approval, and stop
  still need proof.

### What to do next

1. Prove the existing Hermes-plugin flow on a real iPhone: pair, stream, background the app, receive
   a push, reopen/sync the settled reply, and restart/reconnect Hermes.
2. Prove proactive cron delivery through the existing async/home-session path.
3. Fix only failures found in that path. Do **not** build a broad speculative plugin feature list.
4. If real cron output is hard to scan, add one bounded typed `cron_run` event/card next (job, state,
   duration, next run, short summary). The app owns rendering; plugins never send arbitrary React,
   HTML, or unrestricted custom UI.

### Plugin output guardrails

The Hermes alpha currently emits the existing relay shapes: streamed text chunks, ephemeral safe
activity labels, settled replies, errors, and replay/ack frames. It must never expose chain of
thought, tool arguments, or raw tool output as activity. Native approval cards and rich attachments
are not part of the Hermes alpha. Fenced code remains a normal markdown presentation concern; a
plugin is an agent-side channel, not permission to invent a second UI system.

---

## 1. The three identity layers (don't conflate them)

| Layer | What it is | Where it lives | Built? |
|---|---|---|---|
| **Account** | The human (Supabase auth: Apple / Google / email). Holds billing + future relay-routing identity. **Low-sensitivity** — never holds a Hermes key. | Supabase (cloud) + session in Keychain | ✅ (`docs/AUTH.md`) |
| **Agent** | One configured connection to one agent runtime. Hermes is **one-server-one-agent**, so "an agent" = one host+key (direct) or one paired relay channel (native plugin preferred; Go connector fallback). | On-device: metadata in SQLite, secret in Keychain | ✅ this doc |
| **Session** | One conversation thread with one agent. Maps to a Hermes session key (Honcho memory) / OpenClaw session key. | On-device: SQLite (`sessions` + `messages`) | ✅ this doc |

The account sits **above** the agent; it does not replace pairing. One account can hold many agents
(Hermes constraint: multi-agent = multiple host+key pairs — `FRAMEWORKS.md`). One agent holds many
sessions.

---

## 2. Transports — one agent, two ways to reach it

An agent's `transport` decides *how* the phone talks to it. The rest of the model
(sessions, messages, capabilities) is identical regardless of transport.

```
direct (advanced): phone ──► reachable host:8642  (Bearer API key on device)
relay  (default):  phone ──► our relay ◄── native Hermes plugin ──► Hermes Gateway
                                      └── Go connector fallback ──► Hermes/OpenClaw
```

- **`direct`** — host URL + API key. Works only where the host is reachable (LAN / Tailscale /
  tunnel / domain). See `ONBOARDING.md`. The API key is the on-device secret. Accessed via
  `src/app/(app)/connect.tsx`.
- **`relay`** — an 8-character pairing code binds the device to an agent-side relay channel. For Hermes,
  the preferred alpha path is the native platform plugin in `../Summit-Hermes/`; the Go connector
  remains the fallback and currently bridges OpenClaw. It is a short-lived, single-use handshake:
  successful pairing mints a 256-bit device token, which is the on-device secret. The Hermes API
  key never reaches the phone. Primary onboarding path: `src/app/(app)/pair.tsx`. Relay is `relay/`
  (Cloudflare Worker); frame types remain in `protocol/`.

The secret's *meaning* differs by transport (API key vs device token), but storage is the same:
one secret per agent in the Keychain (§4).

---

## 3. Frameworks & the adapter — how a new agent type is added

Hermes and OpenClaw share `/v1/chat/completions` for basic chat and diverge on everything else
(`FRAMEWORKS.md`). We isolate those differences behind **one interface** so the storage, registry,
and UI never branch on framework.

```ts
interface AgentAdapter {
  testConnection(): Promise<AgentCapabilities>;          // probe + feature flags
  sendMessage(content, opts): AsyncIterable<StreamEvent>; // streamed turn
  getStatus(): Promise<AgentStatus>;                      // idle | running | error
  approveRun(runId, approved): Promise<void>;             // Hermes-only in v1
  stopRun(runId): Promise<void>;
}
```

**Adding a future agent type is a four-step recipe — and touches nothing else:**

1. Add the value to the `AgentFramework` union (`src/agents/types.ts`).
2. Implement an `AgentAdapter` for it under `src/agents/adapters/`.
3. Register it in the `makeAdapter()` factory.
4. Add its connect/pair UI (a screen that produces an `Agent` row + a secret).

The data model (transport, secrets, sessions, messages) is framework-agnostic, so a new agent
reuses all of it. Agent-side packaging is separate from the app adapter: the direct Hermes adapter,
the relay adapter, the native Hermes platform plugin, and the Go fallback all feed the same stored
agent/session/message model.

**Hard constraints the adapter must respect** (`FRAMEWORKS.md` — do not design around):
- Hermes: no file upload (inline images only), model field cosmetic, `run_approval` is gated behind
  the `/v1/capabilities` flag — never show approve UI unconditionally.
- OpenClaw: no `/v1/capabilities`, no REST runs/approval (WebSocket-only, issue #20934), different
  session headers. Its adapter needs its own research pass before it ships.

---

## 4. What gets stored, and where

On the phone, three stores by sensitivity:

```
┌─ Keychain (expo-secure-store) ─ SECRETS ONLY ────────────────────────┐
│  agent.<id>.secret  →  direct: Hermes API key  |  relay: device token │
│  Small (≤2KB), encrypted at rest, survives restart, wiped on uninstall │
└───────────────────────────────────────────────────────────────────────┘
┌─ SQLite (expo-sqlite, unencrypted app DB) ─ NON-SECRET ──────────────┐
│  agents     metadata: name, framework, transport, base_url (NO key),  │
│             capabilities, timestamps                                   │
│  sessions   one row per conversation thread (+ remote session key)     │
│  messages   the saved chat — structured blocks, role, timestamp        │
│  app_meta   small key/value (e.g. active_agent_id)                     │
└───────────────────────────────────────────────────────────────────────┘
┌─ React state (AgentProvider) ─ EPHEMERAL ────────────────────────────┐
│  Rehydrated from the two stores on boot. The live registry + active    │
│  agent + in-flight streaming. Never the source of truth.               │
└───────────────────────────────────────────────────────────────────────┘
```

Background delivery adds one bounded, temporary store on the user's agent-side relay host:

```text
native Hermes plugin: ~/.hermes/summit/reply_outbox.json  owner-only (0600), at most 100 replies
Go connector fallback:  ~/.summit/reply_outbox.json        owner-only (0600), at most 100 replies
```

The native plugin or fallback connector writes a settled reply before emitting its terminal frame.
On cold start/reconnect, the app requests pending replies, persists each into SQLite, then
acknowledges the agent-side channel so it can delete them. This is the narrow exception to
phone-only transcript storage required for turns to finish while iOS suspends or kills Summit. The
hosted relay never persists reply content, and push payloads remain content-free.

**The rule:** secrets live *only* in the Keychain. SQLite never holds an API key or device token.
`base_url` (a host, not a credential) lives in SQLite so the registry can list agents without
touching the Keychain. The Keychain is read lazily — only when an actual network call needs the
secret — to minimise how often the secret is in memory.

This honours the privacy model (CLAUDE.md): nothing leaves the phone except calls to the user's own
server; the only sensitive datum is the key/token, and it sits in the iOS Keychain.

### Schema (see `src/db/schema.ts`)

```sql
agents(
  id TEXT PRIMARY KEY,            -- app-generated uuid
  name TEXT NOT NULL,
  framework TEXT NOT NULL,        -- 'hermes' | 'openclaw'
  transport TEXT NOT NULL,        -- 'direct' | 'relay'
  base_url TEXT,                  -- direct: host:port; relay: null (relay is implicit)
  capabilities TEXT,              -- JSON snapshot from last testConnection()
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
)
sessions(
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT,
  remote_session_key TEXT,        -- Hermes X-Hermes-Session-Key / OpenClaw session key
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
messages(
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,             -- 'user' | 'agent' | 'action'
  content TEXT NOT NULL,          -- JSON: the structured Message (blocks/spans) from ui/chat/types
  created_at INTEGER NOT NULL
)
app_meta(key TEXT PRIMARY KEY, value TEXT)
```

Messages store the **structured** message (the existing `Message`/`AgentBlock` model in
`src/ui/chat/types.ts`), serialized as JSON — so markdown/code/approval structure survives a reload,
not just flattened text.

---

## 5. The add-an-agent flow

### Direct mode (built)
1. Connect screen: host + API key.
2. `HermesAdapter.testConnection()` → `GET /v1/capabilities` (specific errors per `ONBOARDING.md`:
   unreachable / 401 / wrong-shape).
3. On success: write the **secret** to Keychain (`agent.<id>.secret`) and the **metadata** row to
   SQLite (`agents`), capturing the capabilities snapshot. Set `app_meta.active_agent_id`.
4. Land in chat.

### Relay mode (slice 3a — `docs/CONNECTION.md`, `src/app/(app)/pair.tsx`)
1. Pair screen: enter the 8-character code printed by the native plugin or fallback connector. Treat it
   as a password: never share it.
2. `RelayClient.pair()` sends a `pair` frame; relay binds device ↔ agent-side relay channel, returns agent
   name/version and mints a durable 256-bit device token.
3. Store the channel locator and **device token** in Keychain as `agent.<id>.secret`; store only
   metadata in SQLite (`transport: 'relay'`, `base_url: null`). Same `agents` row shape.
4. Land in chat.

Both paths end in the **same** persisted state: one `agents` row + one Keychain secret. The registry
can't tell them apart except by `transport`.

---

## 6. Persistence across restart (the "agent doesn't disappear")

On every cold start, `AgentProvider` (wrapped at the root, beside `AuthProvider`):

1. Opens the SQLite DB and runs migrations (idempotent).
2. `listAgents()` → rehydrates the registry from the `agents` table.
3. Reads `app_meta.active_agent_id` → re-selects the last-used agent.
4. Loads that agent's most recent session + its messages (`listMessages`) → the chat reopens exactly
   where the user left it.
5. The secret is **not** loaded yet — it's fetched from the Keychain only when the first network
   call is made.
6. For relay agents, the provider establishes the socket on cold start and the chat syncs any
   plugin- or connector-owned settled replies that completed while the app was unavailable.

Because the source of truth is SQLite + Keychain (both survive process death and reboots, and are
wiped only on uninstall), the agent and its chats persist with zero server round-trip. Reinstall /
new phone = re-add the agent once (the metadata is local; Hermes itself holds nothing about the app).

---

## 7. How chats are saved

- A **session** row is created on first message of a new thread (or restored from the sidebar).
- Each user turn and each completed agent turn is written to `messages` as a structured JSON row,
  with `created_at` for ordering. Streaming writes the final assembled message once the turn
  completes (mid-stream tokens stay in React state; we persist the settled message, not every
  delta — keeps writes cheap and the transcript clean, matching how Hermes treats
  `hermes.tool.progress` as non-persisted).
- `sessions.updated_at` bumps on each new message → drives "recent chats" ordering in the sidebar.
- Deleting an agent cascades to its sessions and messages (FK `ON DELETE CASCADE`) and removes its
  Keychain secret.

---

## 8. File map (backend)

```
src/agents/
  types.ts              Agent, AgentFramework, AgentTransport, AgentCapabilities,
                        StoredMessage, ChatSession — the shared model
  secrets.ts            Keychain wrapper: get/set/delete one secret per agent
  registry.ts           pure helpers (add / remove / select / touch) over Agent[]
  AgentProvider.tsx     React context: rehydrate on boot, expose agents + actions;
                        adapterFor() is memoized via useRef<Map> (one adapter per agent.id)
  adapters/
    types.ts            AgentAdapter, StreamEvent, AgentStatus, RunStatus
    hermes.ts           HermesAdapter — direct mode (capabilities probe + SSE chat)
    relay.ts            RelayAdapter — relay mode (lazy pair on first sendMessage; stubs
                        testConnection/getStatus/approveRun/stopRun)
    openclaw.ts         stub — the extension point (throws "not yet supported")
    index.ts            makeAdapter(agent, getSecret) factory; checks transport === 'relay'
                        before framework switch
  relay/
    client.ts           RelayClient — WS manager: pair(code) → AgentInfo,
                        chat(messages) → AsyncIterable<StreamEvent>, settled-reply sync/ack
    types.ts            AnyFrame + all frame subtypes mirrored from /protocol/
src/db/
  schema.ts             DDL + migration runner
  repository.ts         AgentRepository + ChatRepository interfaces
  memory.ts             in-memory implementation (tests + web fallback)
  sqlite.ts             expo-sqlite implementation (device)
  index.ts              getRepository() — sqlite on native, memory otherwise
src/config.ts           RELAY_WS_URL (ws://localhost:8787 dev / wss://relay.summitapp.dev prod)

relay/                  Cloudflare Worker + PairingChannel Durable Object
  src/index.ts          Worker entry: routes connector (no ?code) vs app (?code=NNNNNN)
  src/channel.ts        PairingChannel DO — thin shell over logic.ts, Hibernation API
  src/logic.ts          Pure pairing logic: handleConnector*/handleApp* functions
  src/__tests__/        9 logic tests (vitest, node env — not @cloudflare/vitest-pool-workers)

connector/              Go binary (gorilla/websocket)
  main.go               Dials relay, sends hello, prints the pairing code, bridges chat frames
  hermes.go             streamChat() — POSTs to Hermes /v1/chat/completions, emits chunks
  outbox.go             bounded owner-only settled reply queue; survives phone/connector restarts

../Summit-Hermes/       Separate native Hermes platform-plugin working copy (alpha)
  summit_hermes/platform.py
                        Native sessions, draft streaming, safe tool activity, relay transport,
                        durable settled-reply outbox and replay
  tests/                Unit coverage for plugin registration, protocol, turns, storage and relay

../summit-openclaw/     Separate native OpenClaw channel working copy (foundation only)
                        Config, relay boundary, durable state and reconnect exist; do not claim
                        SDK-backed chat dispatch, finalization, approval or stop yet

protocol/
  protocol.ts           Canonical JSON frame types (AnyFrame + subtypes)
```

The repository is an **interface** with two implementations so the registry and persistence logic
are unit-testable against the in-memory version without a native SQLite module.

---

## 9. Out of scope here (tracked elsewhere)

- The **relay server and agent-side channels** — separate infrastructure/packages, not the app's
  on-device backend (`docs/CONNECTION.md`, `../Summit-Hermes/`, `connector/`).
- Arbitrary plugin-rendered UI, chain-of-thought/tool-log transcript output, rich attachments, and
  native Hermes approval cards. Add only bounded typed events after a real device need is proven.
- Native OpenClaw chat dispatch and controls — the separate OpenClaw plugin remains a foundation
  until its public SDK contract is proven.
