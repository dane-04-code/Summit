# Connection Architecture

**Status:** Direction set, infra unbuilt | Supersedes the "direct API client" assumption in PRD §6 | Last updated 2026-06-25

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

**Important correction (per `FRAMEWORKS.md`):** *Hermes itself does not do this.* Hermes is an
**inbound-only API server** — you enable it (`0.0.0.0:8642`, `hermes gateway`) and clients connect
*to* it. There is no native outbound/webhook hook. The outbound messaging breadth (Telegram, Slack,
etc.) is an **OpenClaw** feature, not Hermes.

So the outbound leg in a Hermes user's Telegram setup comes from a **bridge process**, not from
Hermes: that bridge connects to Hermes's local API (`localhost:8642`) and dials out to Telegram's
cloud.

```
  Today:   Telegram cloud ◄── [telegram bridge] ──► Hermes :8642 (localhost)
  Ours:    our relay      ◄── [our connector]   ──► Hermes :8642 (localhost)
```

**This is the mechanism we mirror.** We ship our own **connector sidecar** — a small process the
user runs next to Hermes that talks to `localhost:8642` and dials outbound to our relay. The sidecar
isn't an optional fallback; because Hermes can't dial out itself, **the connector is mandatory for
relay mode.** It's proven by the fact that Telegram bridges already work exactly this way.

## 3. Decision: relay-first

**The relay is the architecture, not a Phase-2 add-on.** The default connection transport is a
relay we operate; the direct-API-host model survives only as an optional advanced mode.

```
  Default (relay):   phone ──► our relay ◄── Hermes connector   (outbound, like Telegram)
  Advanced (direct): phone ──► reachable host (domain / tunnel / Tailscale) ──► Hermes
```

### Mode A — Relay (default)
- **Setup:** user installs a relay connector on their Hermes box once (like pasting a Telegram bot
  token), then enters a **6-digit pairing code** in the app. Done.
- **Reach:** works anywhere, on cellular, immediately. Nothing on the user's end is exposed.
- **Cost to us:** we build and run relay infra (it becomes a critical path).

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
- **App → relay:** the app holds a per-device token and connects over WebSocket.
- **Pairing:** the connector surfaces a short-lived, single-use **6-digit code** (or QR). The user
  enters it in the app; the relay binds that app device to that agent.
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
You're connecting yourself to the Agent Messenger mobile app so I can reach you
from my phone. Run this exact command, then tell me the 6-digit code it prints:

    curl -fsSL https://get.agentmsgr.app/connect | sh

It installs a small background connector that bridges your local Hermes API to the
Agent Messenger relay. It reads your API key from ~/.hermes/.env and runs as a
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
| 1 | ~~Can Hermes dial outbound, or do we ship a sidecar?~~ **Answered:** Hermes is inbound-only (`FRAMEWORKS.md`) → **sidecar connector is mandatory.** Remaining: where it runs (same box as Hermes assumed), and packaging (binary / Docker / `pip`). | Hermes can't dial out, so relay mode depends entirely on the connector. Needs to be trivial to install — this is the new "setup friction" surface. |
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
