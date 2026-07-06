# OpenClaw Adapter — Research Notes

> ✅ **VERIFIED against a live Gateway frame trace (July 2026).**
> The original pass (below) was an unverified sketch. A second OpenClaw agent has
> since run **live traces against the actual Gateway** and confirmed or corrected
> the specifics. Corrections are marked **[TRACE]** inline. The handshake, method
> names, and event shapes below are now trustworthy enough to build against —
> **from the connector, not the app** (see architecture caveat).
>
> **Still open — one conflict to reconcile:** the live trace says **both**
> `/v1/chat/completions` **and** `/v1/responses` are disabled by default (see §6).
> Our `FRAMEWORKS.md` claims chat-completions is available and only `/v1/responses`
> is off. Either `FRAMEWORKS.md` is wrong or this is per-Gateway config. It doesn't
> block the WS path (which is what we'd build), but the HTTP "easy path" is **not**
> config-free. Tracked as an open item at the bottom.
>
> **Architecture caveat (unchanged):** Summit does **not** connect to OpenClaw as a
> direct WS operator client. The app talks to the Cloudflare relay; a Go connector
> sidecar talks to the agent locally. This WS control plane lives in the
> **connector**. The [TRACE] auth finding below makes that a much better fit than
> the original notes assumed — no device keypair needed for a loopback sidecar.

---

## 1. Transport

- WebSocket-only control plane. `ws://<host>:18789` (or `wss://` for TLS).
- All frames are text, JSON-encoded — one object per frame, no binary framing.
- Pre-connect payload cap: 64 KiB. After handshake, respect
  `hello-ok.policy.maxPayload`. **[TRACE]** live value `26214400` (~25 MB);
  `maxBufferedBytes` `52428800` (~50 MB).
- Summit connects as an **operator** client (not a node) — it sends/receives
  chat, it doesn't expose device capabilities.
- **[TRACE] Protocol version is `3`** (`minProtocol: 3`, `maxProtocol: 3`).

## 2. Handshake — VERIFIED, and simpler than the original sketch

**[TRACE] The big correction: a loopback backend client needs NO Ed25519 device
signing and NO pairing dance.** The Gateway has a trusted-backend exception. The
original notes (device fingerprint + `publicKey` + `signature` over the nonce +
`openclaw devices approve`) apply to *untrusted* operator clients; they do **not**
apply to a same-host sidecar. This is exactly our connector.

Pick the identity carefully — it decides the scopes you get:

| `client.id` / `mode`                          | Device signing? | Scopes granted                                    |
| --------------------------------------------- | --------------- | ------------------------------------------------- |
| `openclaw-ios` / `cli` (+ loopback)           | ❌ No           | `[]` — **empty, useless** (`chat.send` → missing scope) |
| `gateway-client` / `backend` (+ loopback + token) | ❌ No       | ✅ `operator.read`, `operator.write`, `operator.approvals` |

**Use `client.id: "gateway-client"`, `client.mode: "backend"`, `role: "operator"`,
shared token in `auth.token`.**

Flow:

1. **Server → client**, immediately on TCP open:
   ```json
   { "type": "event", "event": "connect.challenge",
     "payload": { "nonce": "<uuid>", "ts": 1783371647000 } }
   ```
2. **Client → server** — first frame, a `connect` req:
   ```json
   {
     "type": "req", "id": "<uuid>", "method": "connect",
     "params": {
       "minProtocol": 3, "maxProtocol": 3,
       "client": { "id": "gateway-client", "version": "1.0.0", "platform": "ios", "mode": "backend" },
       "role": "operator",
       "scopes": ["operator.read", "operator.write", "operator.approvals"],
       "caps": [], "commands": [], "permissions": {},
       "auth": { "token": "<gateway-shared-token>" },
       "locale": "en-US", "userAgent": "summit-connector/1.0.0"
     }
   }
   ```
   **[TRACE] No `device` block, no signature** — that was the unverified part, and
   it's unnecessary for the backend/loopback path.

   Enum constraints (from compiled source):
   - `client.id` ∈ {webchat-ui, openclaw-control-ui, openclaw-tui, webchat, cli,
     `gateway-client`, openclaw-macos, openclaw-ios, openclaw-android, node-host,
     test, fingerprint, openclaw-probe}
   - `client.mode` ∈ {webchat, cli, ui, `backend`, node, probe, test}
3. **Server → client**: `hello-ok`:
   ```json
   {
     "type": "res", "id": "<same-id>", "ok": true,
     "payload": {
       "type": "hello-ok", "protocol": 3,
       "server": { "version": "2026.5.6", "connId": "<uuid>" },
       "features": { "methods": ["health","chat.send","sessions.messages.subscribe","exec.approval.resolve", ...],
                     "events": ["connect.challenge","session.message","agent","chat","exec.approval.requested","exec.approval.resolved", ...] },
       "snapshot": { ... },
       "auth": { "role": "operator", "scopes": ["operator.read","operator.write","operator.approvals"] },
       "policy": { "maxPayload": 26214400, "maxBufferedBytes": 52428800, "tickIntervalMs": 30000 }
     }
   }
   ```
   **[TRACE] No `auth.deviceToken` is returned on the backend path** (there's no
   device to persist). Re-auth is just: reconnect and re-send the shared token.
   Gate on `hello-ok.payload.auth.scopes` actually containing `operator.write` /
   `operator.approvals` before enabling send / approve.

## 3. Sending / receiving — VERIFIED with corrected params

- **Subscribe first:** `sessions.messages.subscribe`. **[TRACE] param is `key`**
  (not `sessionKey`), e.g. `{ "key": "main" }`. Server resolves `"main"` →
  `"agent:main:main"` and echoes it back: `{ "subscribed": true, "key": "agent:main:main" }`.
- **Send:** `chat.send`. **[TRACE] param is `message`** (not `text`), plus a
  **required `idempotencyKey`** and `sessionKey`:
  ```json
  { "type": "req", "id": "<uuid>", "method": "chat.send",
    "params": { "message": "...", "idempotencyKey": "<uuid>", "sessionKey": "main" } }
  ```
  The response only acks: `{ "runId": "<idempotencyKey>", "status": "started" }`.
  **The `runId` is the `idempotencyKey` you sent** — generate it client-side so you
  can correlate the streamed events before the ack even lands.
- The reply arrives as **events**, not in the ack:
  - **`session.message`** — user echo, then the assistant turn. Final assistant
    message carries `stopReason: "end_turn"` and full `content[]`. Each has
    `__openclaw: { id, seq }`, plus top-level `messageId` / `messageSeq`.
  - **`agent`** — lifecycle stream: `data.phase` ∈ `start` | `tool` | `done` |
    `error`. Use `phase: "start"`/`"tool"` to drive a "thinking…"/tool indicator.
  - **`chat`** — aggregated turn state: `state` ∈ `done` | `error`, with
    `errorMessage`. This is the clean "turn finished" signal to close the stream.
- No raw token deltas over WS — you get built messages, not per-token chunks.
  (Contrast with Hermes SSE, which streams `delta.content` token-by-token.)

## 4. Approvals — VERIFIED

- Broadcast: **`exec.approval.requested`** with `approvalId`, `sessionKey`,
  `command`, `systemRunPlan { argv, cwd, rawCommand, sessionKey, agentId }`.
  Plugin approvals are a separate `plugin.approval.requested` shape.
- Resolve: **`exec.approval.resolve`** with `approvalId` + `decision: "approve" | "deny"`.
  Requires `operator.approvals` at connect (events still arrive without it, but the
  resolve call fails). We request it in §2, so we're covered.
- `exec.approval.resolved` broadcasts when done (by us or another client); the
  suspended turn resumes.

## 5. Keepalive / reconnect — corrected interval

- **[TRACE] `tick` keepalive fires at `policy.tickIntervalMs` = 30 s** (the
  original ~15 s guess was wrong). Close + reconnect if silence exceeds
  `tickIntervalMs * 2` (60 s).
- Reconnect with exponential backoff, 1 s → capped at 30 s. (Matches the
  connector's existing relay-reconnect posture.)

## 6. HTTP OpenAI-compatible endpoint — the "easy path" is NOT free

**[TRACE] Both `/v1/chat/completions` and `/v1/responses` are disabled by default**
on the traced Gateway (`gateway.http` was `{}`; `GET /v1/models` returned the
Control-UI HTML, not JSON). Enable via:
```
gateway: { http: { endpoints: { chatCompletions: { enabled: true }, responses: { enabled: true } } } }
```
⚠️ **This contradicts our `FRAMEWORKS.md`**, which states chat-completions is
available and only `/v1/responses` is off. Unreconciled — see open item.

Implications for us:
- The HTTP path would let the connector reuse the generic OpenAI adapter pattern
  for **chat only**, but it requires the user to edit their Gateway config first.
- **Approvals are WS-only regardless** (the HTTP caller is treated as a full
  operator, but there's no HTTP resolve). So HTTP never removes the WS dependency.
- Conclusion: **WS-only in the connector is the simpler, self-contained design** —
  one persistent connection, no user config step, chat + approvals through one
  surface. The OpenClaw agent recommended the same.

## 7. HTTP + WS from one connector — same identity

If we ever did want both: they share the same token and the same operator
principal (HTTP via `Authorization: Bearer <token>`, WS via `auth.token`). No
separate sessions. Not needed for the WS-only plan, noted for completeness.

---

## Open items before / during build

1. **Reconcile the HTTP-endpoint conflict** (§6) with `FRAMEWORKS.md`. Doesn't
   block the WS build, but our own docs are currently wrong somewhere.
2. **Confirm the Gateway WS port** — notes/`FRAMEWORKS.md` say `18789`; the trace
   didn't restate it. Verify against a live install before wiring the dial.
3. **Shared-token provisioning** — where the connector reads the OpenClaw gateway
   token from (analogous to Hermes reading `~/.hermes/.env`). Needs an install-flow
   decision.

> **Connector env contract (Phase 1, implemented):** set `AGENT_FRAMEWORK=openclaw`,
> `OPENCLAW_WS_URL=ws://localhost:18789`, `OPENCLAW_TOKEN=<gateway-shared-token>`.
> Hermes env (`HERMES_BASE_URL`/`HERMES_API_KEY`) is not required in this mode.
> Still open: where the install script sources `OPENCLAW_TOKEN` from on a real box.
