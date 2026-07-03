# Agents: Connection, Storage & Persistence

**Status:** Backend + relay walking skeleton built | Last updated 2026-06-29

How an agent (Hermes today, OpenClaw later, anything else after) gets **added**, **connected**,
**stored on the phone**, and **kept alive across app restarts** — including saved chat history.

This is the structural contract. Read it before touching `src/agents/` or `src/db/`. It is grounded
in `FRAMEWORKS.md` (API surfaces + hard constraints) and `docs/CONNECTION.md` (relay vs direct).

---

## 1. The three identity layers (don't conflate them)

| Layer | What it is | Where it lives | Built? |
|---|---|---|---|
| **Account** | The human (Supabase auth: Apple / Google / email). Holds billing + future relay-routing identity. **Low-sensitivity** — never holds a Hermes key. | Supabase (cloud) + session in Keychain | ✅ (`docs/AUTH.md`) |
| **Agent** | One configured connection to one agent server. Hermes is **one-server-one-agent**, so "an agent" = one host+key (direct) or one paired connector (relay). | On-device: metadata in SQLite, secret in Keychain | ✅ this doc |
| **Session** | One conversation thread with one agent. Maps to a Hermes session key (Honcho memory) / OpenClaw session key. | On-device: SQLite (`sessions` + `messages`) | ✅ this doc |

The account sits **above** the agent; it does not replace pairing. One account can hold many agents
(Hermes constraint: multi-agent = multiple host+key pairs — `FRAMEWORKS.md`). One agent holds many
sessions.

---

## 2. Transports — one agent, two ways to reach it

An agent's `transport` decides *how* the phone talks to it. The rest of the model
(sessions, messages, capabilities) is identical regardless of transport.

```
direct (built):  phone ──► reachable host:8642  (Bearer API key on device)
relay  (built):  phone ──► our relay ◄── connector ──► Hermes  (device token on device,
                                                                  API key stays on server)
```

- **`direct`** — host URL + API key. Works only where the host is reachable (LAN / Tailscale /
  tunnel / domain). See `ONBOARDING.md`. The API key is the on-device secret. Accessed via
  `src/app/(app)/connect.tsx`.
- **`relay`** — a 6-digit pairing code binds the device to a connector that dials our relay
  (`docs/CONNECTION.md`). The on-device secret is the **pairing code** (used as a device token for
  this spike; persistent tokens are slice 3c), never the Hermes key. Primary onboarding path:
  `src/app/(app)/pair.tsx`. Relay is `relay/` (Cloudflare Worker), connector is `connector/` (Go),
  frame types in `protocol/`.

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
reuses all of it. This is the "formal adapter abstraction, built from real cases" the brief earmarks
for later — we lay the foundation now with the two real cases (Hermes built, OpenClaw stubbed as the
extension point).

**Hard constraints the adapter must respect** (`FRAMEWORKS.md` — do not design around):
- Hermes: no file upload (inline images only), model field cosmetic, `run_approval` is gated behind
  the `/v1/capabilities` flag — never show approve UI unconditionally.
- OpenClaw: no `/v1/capabilities`, no REST runs/approval (WebSocket-only, issue #20934), different
  session headers. Its adapter needs its own research pass before it ships.

---

## 4. What gets stored, and where

Three stores, by sensitivity:

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
1. Pair screen: enter the 6-digit code printed by the connector.
2. `RelayClient.pair()` sends a `pair` frame; relay binds device ↔ connector and returns agent
   name/version (the "capabilities" equivalent).
3. Store the **pairing code** in Keychain as `agent.<id>.secret` (acts as device token for this
   spike), metadata in SQLite (`transport: 'relay'`, `base_url: null`). Same `agents` row shape.
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
                        chat(messages) → AsyncIterable<StreamEvent>
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
  main.go               Dials relay, sends hello, prints 6-digit code, bridges chat frames
  hermes.go             streamChat() — POSTs to Hermes /v1/chat/completions, emits chunks

protocol/
  protocol.ts           Canonical JSON frame types (AnyFrame + subtypes)
```

The repository is an **interface** with two implementations so the registry and persistence logic
are unit-testable against the in-memory version without a native SQLite module.

---

## 9. Out of scope here (tracked elsewhere)

- The **relay server + connector sidecar** — separate infrastructure, not the app's on-device
  backend (`docs/CONNECTION.md`).
- Rewiring the chat screen's stub stream to the live `HermesAdapter` — frontend integration, a
  follow-on once this backend lands (the screen still seeds + stubs today).
- OpenClaw's real adapter — needs its own research pass (`FRAMEWORKS.md` §OpenClaw).
