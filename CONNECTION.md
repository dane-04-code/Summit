# Connection Architecture

**Status:** Relay deployed and working reliably in active testing; native Hermes platform plugin
alpha built; Go connector retained as compatibility fallback | Last reviewed 2026-07-21

> **Current delivery note:** this document records the relay architecture. The native Hermes
> platform plugin now supplies the preferred outbound leg from inside Hermes; the Go connector is
> no longer the only or intended default Hermes integration. V1 work is chat/output polish and
> real-device proof, not a new transport design. See `docs/PROJECT_STATUS.md` for the release view.

---

## 1. The constraint we can't escape

The phone has to reach Hermes. Hermes is self-hosted — almost always behind NAT on a home
network. A phone on cellular **cannot** reach a LAN address like `my-hermes.home:8080`; that
name only resolves on the home WiFi.

Any architecture where the app is a **direct API client** (the original PRD model: app calls
`POST /v1/chat/completions` on the server) therefore requires the user to *expose their server*
to the internet — port-forwarding, a tunnel, or a VPN like Tailscale.

That is **strictly harder to set up than the Telegram bot we're trying to replace.** If our app
asks for a host URL and Telegram doesn't, we lose on the one dimension that already works for the
user. This is disqualifying, not a minor UX wrinkle.

## 2. The Telegram insight (why it "just works") — corrected for Hermes

A self-hosted Telegram bot works from anywhere with zero networking config because something
**connects _outbound_ to Telegram's cloud** (long-polling `getUpdates`, or a webhook); Telegram is
the rendezvous in the middle, so nothing reaches *in* to the home network.

**Important distinction:** Hermes' HTTP API is an **inbound-only API server** — you enable it
(`0.0.0.0:8642`, `hermes gateway`) and clients connect *to* it. That still makes direct mobile API
access unsuitable. Hermes now also has Summit's native **platform plugin** alpha, however: it runs
inside the gateway and can maintain the outbound relay connection while using Hermes' native
session and delivery interfaces.

The native plugin is the preferred outbound leg. The separate bridge remains a compatible fallback
for hosts that cannot use the plugin.

```
  Preferred: our relay ◄── [Summit Hermes platform plugin] ◄── native Hermes API
  Fallback:  our relay ◄── [Go connector] ──► Hermes :8642 (localhost)
```

**The relay shape remains the same.** The native plugin is the preferred Hermes implementation of
the outbound leg. The Go connector runs next to Hermes, talks to `localhost:8642`, and dials the
same relay when the plugin is unavailable; it remains an explicit fallback, not a separate product
path.

## 3. Decision: relay-first

**The relay is the architecture, not a Phase-2 add-on.** The default connection transport is a
relay we operate; the direct-API-host model survives only as an optional advanced mode.

```
  Default (relay):   phone ──► our relay ◄── Hermes plugin      (outbound, native)
  Fallback (relay):  phone ──► our relay ◄── Go connector       (outbound, compatible)
  Advanced (direct): phone ──► reachable host (domain / tunnel / Tailscale) ──► Hermes
```

### Mode A — Relay (default)
- **Setup:** user enables the Summit Hermes plugin and enters its **6-digit pairing code** in the
  app. The Go connector provides the same pairing flow as a compatibility fallback.
- **Reach:** works anywhere, on cellular, immediately. Nothing on the user's end is exposed.
- **Cost to us:** we build and run relay infra (it becomes a critical path).

**Production domain convention:** hosted relay services live under `summitapp.dev`:
`relay.summitapp.dev` for WebSocket relay traffic, `api.summitapp.dev` for pairing/API requests, and
`get.summitapp.dev` for the connector installer.

### Mode B — Direct (advanced / no-middleman)
- **Setup:** user pastes a globally reachable host + API key (their domain, Cloudflare/ngrok tunnel,
  or Tailscale address).
- **Reach:** works anywhere *the address is reachable* — i.e. the user has done the networking.
- **Cost to us:** zero infra. Serves the privacy-maximalist / Tailscale crowd who refuse a relay.

The UI is built relay-first; direct mode is a toggle in the connect flow, not the headline path.

## 4. How the relay works

The relay is a thin **rendezvous + bridge** — it pairs an app to an agent and forwards frames. It
does not run agents or store transcripts (beyond what's needed in flight).

```
  ┌────────┐   WSS    ┌───────────┐   WSS (outbound)   ┌──────────────────┐
  │  App   │ ───────► │   Relay   │ ◄───────────────── │ Hermes connector │
  └────────┘          └───────────┘                    └──────────────────┘
   device token        binds app↔agent                  holds the Hermes API key
   (no Hermes key)      by pairing code                  server-side
```

- **Connector → relay:** the connector dials out over a persistent WebSocket, authenticates, and
  registers the agent.
- **App → relay:** the app holds a private 256-bit per-device token in Keychain and connects over
  WebSocket. The relay authenticates it before forwarding chat, API, approval, or push frames.
- **Pairing:** the connector surfaces a short-lived, single-use **6-digit code** (or QR). The user
  enters it in the app; the relay binds that app device to that agent and replaces the code with
  separate 256-bit app and connector credentials. The code is never a persistent login secret.
- **Forwarding:** chat messages, streamed response chunks, tool-progress events, status, and
  run/approval events all flow as WebSocket frames in both directions.

### Bonus 1 — the API key never touches the phone
In relay mode the Hermes API key stays **server-side with the connector.** The phone holds only a
relay device token. That's a *better* privacy story than the original "type your API key into the
app" flow — there's nothing sensitive on the device to leak.

### Bonus 2 — RN streaming gets easier
The app talks **WebSocket** to the relay, not SSE. This sidesteps the React-Native SSE brittleness
flagged as a Phase-1 risk in the PRD — the relay terminates Hermes's SSE and re-emits clean WS
frames the app just reads.

### Bonus 3 — push falls out for free
The relay already holds a persistent outbound channel from Hermes **and** a device token for the
phone. It can forward events to APNs without Hermes knowing anything about Apple. **Connection and
push become one system** — the relay the PRD wanted for push notifications is the same relay that
does connection. Build it once.

## 5. The pairing flow (relay mode)

1. **One-time, on the server:** the connector gets installed on the Hermes box (see §5a — the agent
   can do this itself). Connector dials the relay and surfaces a 6-digit code.
2. **In the app:** "Enter pairing code" → 6 digits.
3. Relay binds device ↔ agent; agent capabilities (name + version) are forwarded back.
4. App shows `✓ Connected to Hermes v2.4` and slides into the chat.
5. Device token stored in the iOS Keychain. **No host, no API key, no accounts** — the pairing is
   the account.

## 5a. Agent-assisted onboarding (the headline path)

The connector install is the *only* real friction in relay mode — and the target user already runs
an agent with **terminal and file tools active on the Hermes box.** So we don't make the human run
install commands; we have **the agent install its own connector.** The agent gives itself a phone.

**Flow:**
1. The app's pair screen shows a **copyable prompt** (below) and a 6-digit code field.
2. User pastes the prompt to their agent wherever they already talk to it (desktop, Telegram, CLI).
3. The agent runs the install; the connector daemonizes, dials the relay, and a 6-digit code comes
   back; the agent **says the code to the user in chat.**
4. User types the code into the app. Connected.

The agent does the plumbing; the human just relays a code.

**Example prompt (Hermes):**
```
You're connecting yourself to the Summit mobile app so I can reach you
from my phone. Run this exact command, then tell me the 6-digit code it prints:

    curl -fsSL https://get.summitapp.dev/connect | sh

It installs a small background connector that bridges your local Hermes API to the
Summit relay. It reads your API key from ~/.hermes/.env and runs as a
service. If anything errors, paste the full output back to me.
```

**Design rules that make this reliable — not a gimmick:**

- **Deterministic install, not agent improvisation.** The prompt points at a fixed one-liner; the
  agent is a convenient *shell + code-relay*, not asked to "figure out" how to install. Freeform
  reasoning here gets things subtly wrong.
- **The connector MUST daemonize.** If the agent runs it inside a single tool call, the process dies
  when the turn ends. The install script registers a background service (systemd/launchd, or `nohup`
  fallback) — this is the detail that quietly breaks the naive version.
- **Transparency over magic.** We're piping a script into someone's agent shell. This audience does
  that daily, but link the script, sign it, and let them inspect it. Never hide what it does.
- **Framework detection.** One install endpoint detects Hermes vs OpenClaw and lays down the right
  connector + reads the right key location (`~/.hermes/.env` vs OpenClaw gateway config). The prompt
  text differs per framework; the endpoint logic is shared.
- **Fallbacks:** if the agent is sandboxed (no outbound shell / can't install a service), fall back
  to (a) the human running the same one-liner manually, or (b) direct mode (host + key).

## 5b. What actually happens at the relay (implementation notes)

These are the non-obvious implementation details that only surfaced during live testing.

### Durable Object state must be persisted to storage

The relay uses Cloudflare Durable Objects with the **Hibernation API** (`acceptWebSocket`). This lets
the DO sleep between messages — Cloudflare keeps the WebSocket connections alive, but **all in-memory
state is lost on hibernation.** The DO's constructor runs fresh on every wake.

The consequence: if `connectorInfo` lives only in `this.state` (an in-memory field), it will be null
by the time the app sends its `pair` frame — even seconds later. The DO hibernated between the
connector's `hello` and the app's `pair`.

**Fix:** every state mutation is now written to `doState.storage` immediately, and the constructor
reloads from storage via `blockConcurrencyWhile`. See `relay/src/channel.ts`.

### The connector must send WebSocket pings

Cloudflare closes idle WebSocket connections after roughly 2 minutes with close 1006 (abnormal
closure). The connector sends a `PingMessage` control frame every 30 seconds to keep the connection
alive. Cloudflare's Hibernation API handles pong responses automatically on the relay side — no
relay-side ping handler needed.

### The connector must reconnect on drop

Even with pings, network hiccups happen. The connector wraps its entire connect-and-read loop in an
outer retry loop that waits 5 seconds and reconnects on any error. On reconnect, the relay mints a
new pairing code, which is written to `~/.summit/pairing_code` so the agent (or user) can always
`cat` the current code without digging through logs.

### Non-root install fallback

The install script defaults to `~/.local/bin/summit-connector` when `/usr/local/bin` isn't writable.
Most Hermes users run as a non-root user. The original script hardcoded `/usr/local/bin` and failed
silently — the config file was written but the binary was never installed.

## 6. Security & privacy

- **Pairing codes:** short-lived, single-use, rate-limited.
- **Tokens:** per-device, revocable from the server side; killing a device doesn't rotate the
  Hermes key.
- **Transport:** WSS / TLS throughout.
- **Content privacy:** v1 relay sees traffic in flight (TLS to the relay, not end-to-end).
  End-to-end encryption (relay blind to content) is a later privacy upgrade worth pricing out for
  this audience. The **self-hostable, open-core relay** is the mitigation that matters most: anyone
  who doesn't trust our hosted relay can run their own, or fall back to direct mode.

## 7. Open questions (verify before committing)

| # | Question | Why it matters |
|---|----------|----------------|
| 1 | ~~Can Hermes provide an outbound relay leg?~~ **Answered:** the inbound HTTP API cannot, but the built native Hermes platform plugin can. The Go sidecar remains the compatibility fallback. Remaining: validate plugin install/upgrade and fallback guidance on real hosts. | Relay mode no longer depends entirely on the connector; native-plugin install quality is now the primary setup-friction surface. |
| 2 | Hosted relay vs. self-host only for v1? | Hosted = best UX + monetization; self-host only = zero infra liability but worse onboarding. |
| 3 | E2E encryption in v1, or TLS-to-relay + open-core trust? | Privacy-conscious audience; affects relay complexity. |
| 4 | Do we ship **direct mode** in v1 at all, or relay-only first? | Direct is cheap to keep but splits the connect UI. |

## 8. Implications

- The original PRD premise — "API-based direct client is the correct and necessary path" — is
  **half right.** API-based, yes; *direct client*, no. Hermes is inbound-only, so reaching it from
  anywhere requires either (a) the user exposing the server (direct mode), or (b) a **connector
  sidecar** that dials out to a relay (default mode). There is no third option where the phone
  reaches a LAN Hermes directly.
- The connect screen is a **pairing-code screen**, not a host/key form (host/key moves to advanced
  mode).
- The relay decision **gates the whole product**, not just push notifications.
