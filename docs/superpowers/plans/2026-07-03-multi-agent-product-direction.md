# Multi-Agent Product Direction
_Summit — mobile agent control, July 2026_

---

## What We're Building

Summit is a **mobile-first messaging interface for autonomous AI agents**. Not a dashboard. Not a control panel. A messaging app — Telegram quality, but purpose-built for people who run self-hosted AI agents and want to interact with them from their phone without setting up a VPN or loading a heavy desktop app.

The mental model: **Telegram × 5**. Everything lives in a thread. You send a message, the agent responds. If the agent needs you — approval, a decision, a nudge — it sends you something. You react and pocket the phone. That's the entire product.

---

## The User

**Not** a developer sitting at a desktop. Not someone who wants a Tony Stark-style dashboard full of metrics and panels.

**Is**: someone at the gym, on the treadmill, at a coffee shop, walking around at lunch. They have an AI agent running somewhere that does real work for them. They want to check in, fire off a quick message, approve something the agent flagged, and get back to their day.

The Telegram comparison is deliberate. Telegram works for agent interaction today — people already use it that way. Summit is what that looks like if you build it properly: no bots API kludge, real streaming, native approval flows, and a relay that means you never touch Tailscale.

---

## Positioning vs the Official Hermes App

The official Hermes iOS app requires Tailscale (a VPN) to reach the Hermes server. That is a developer workflow — most Hermes users don't want to configure a VPN to use their phone.

Summit's setup: ask your agent to run one command → it prints a 6-digit code → type the code in the app. Done. No VPN, no open ports, no networking knowledge.

That simplicity is the product. The relay/connector architecture (run a sidecar next to your agent, dial outbound to a Cloudflare Worker) is the technical moat — nobody else has built this for self-hosted agents.

---

## Agent Types to Support

### Tier 1 — Native integrations
Full feature support. We know the protocol deeply enough to surface framework-specific capabilities.

| Agent | Status | Native features |
|---|---|---|
| **Hermes** | Live | Chat, SSE streaming, run approval, cron jobs |
| **OpenClaw** | In progress | Chat (more TBD) |

### Tier 2 — Generic OpenAI-compatible
Any server that speaks the OpenAI `/v1/chat/completions` format works through a single generic adapter. This covers most of the self-hosted AI ecosystem:

- Ollama (run local models)
- LM Studio
- llama.cpp server
- Open WebUI backends
- n8n (AI Agent node exposes a compatible endpoint)
- Dify (self-hosted)
- LangServe / LangGraph deployments
- OpenRouter
- Any future framework — the OpenAI API format won the industry

For Tier 2 agents, Summit provides clean messaging. Nothing more, nothing less. No empty menu items for features that don't exist.

---

## Two-Track Architecture

**Track 1 — Generic floor**: User enters a URL + API key. Connects. Gets a chat thread. Works for everything in Tier 2. The relay pairing flow also works here — install the connector next to any Tier 2 agent, pair with a code, done.

**Track 2 — Native ceiling**: For Tier 1 agents, the app surfaces framework-specific features on top of the messaging baseline. These features appear only when the agent's capabilities object says they're supported.

The user never sees the difference explicitly. They just see what their agent can do.

---

## Capability-Driven UI

When an agent is paired, it reports its capabilities. The app surfaces features based on what the agent supports — features appear or disappear gracefully. No empty screens, no disabled menu items.

| Capability flag | What appears in the app |
|---|---|
| Always | Chat thread, composer, push notifications |
| `hasRunApproval` | Approval cards inline in the thread |
| `hasJobs` | Cron screen in the sidebar |
| (generic endpoint) | Just the thread — no extra chrome |

The design principle: **additive, never subtractive**. The base experience is always complete. Capabilities add on top.

---

## Connection / Onboarding Flow

### Relay path (primary — for self-hosted agents)
1. Pair screen: user copies a prompt or curl command, pastes it to their agent / runs it in a terminal
2. Connector installs as a background process next to the agent
3. Connector dials outbound to the Summit relay — no inbound ports needed
4. Connector prints a 6-digit code
5. User types the code in the app — paired

Code is stable: if the connector restarts, it reclaims the same code. The app reconnects automatically on the next message send. No re-pairing needed.

### Direct path (advanced — for accessible servers)
User enters a base URL and API key directly. Works for Ollama on a local network, any server reachable without a relay. Lives behind an "Advanced" link on the pair screen — not the default path.

---

## Feature Priority

In order of impact for the core use case:

1. **Push notifications** — critical. Without them the whole "notification-driven" model breaks. The agent can't get your attention at the gym if it can't push. Needs a backend service (likely Supabase Edge Functions + APNs/FCM).

2. **Generic OpenAI-compatible connection** — makes the app useful to anyone running a local AI setup, not just Hermes users. One adapter, covers everything in Tier 2.

3. **Capability-driven feature surfacing** — ensure features appear/disappear cleanly based on what the connected agent supports. No broken empty states.

4. **Deeper Hermes native features** — run history, richer approval flows, cron management polish.

5. **OpenClaw native integration** — once OpenClaw's API surface is stable.

---

## What NOT to Build

- Multi-column dashboards or status panels with metrics
- A "runs" tab separate from the thread — runs surface as messages
- Complex navigation or tab bars
- Any feature that requires the user to understand which "mode" they're in
- Anything that makes the app feel heavier than Telegram

If a feature can't be expressed as a message or a subtle badge in the header, it probably doesn't belong in this version.

---

## Open Questions for Next Planning Session

- Push notification backend: Supabase Edge Functions + APNs/FCM, or a dedicated notifications service?
- Generic connection UI: does it live on the pair screen as an "Advanced" path, or a separate connect screen? (connect screen already exists — probably use that)
- How do we handle an agent that supports approval but not cron — does the sidebar just not have a Cron item, or is there a graceful "not supported" state?
- OpenClaw timeline — what features will it have that differ from Hermes?
