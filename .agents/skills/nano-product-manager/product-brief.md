# Summit — Product Brief

*The single source of product truth for the nano product manager. Synthesizes `PRD.md`,
`FRAMEWORKS.md`, and `CONNECTION.md`. When those change, update this. Last synced: 2026-07-17.*

---

## 1. What it is (in one breath)

**Summit** — a React Native (iOS-first, Expo) mobile app that gives people running
self-hosted AI agents (Hermes today, OpenClaw later) a **first-class mobile client** for their
agent: reach it from anywhere, message it fluidly, see its status, and act on blocking decisions
with one tap. It is *not* a replacement for Telegram/Discord as everyday messengers — it fixes the
specific things those break when you're working with an agent on your phone.

**Codename:** Summit · **Stage:** implementation ready for real-device beta verification; not yet
store-ready · **Author:** Dane

## 2. The positioning thesis (memorize this — it's the spine)

**We sell the *flow*, not a feature.** The product is a fast, fluent mobile experience for your
agent. Markdown rendering, push, and approve/stop are *parts* of that experience — the most
*visible* part is proper markdown (raw Telegram mangles tables/code), but **markdown is not the
point; the whole thing feeling first-class is the point.**

- **Cockpit, not chatroom.** Something is running on a server; you're away from your desk; it might
  stop and ask "can I run this command?" The feeling is calm authority with your hand near the kill
  switch — quiet until *you* act.
- The differentiator vs. a raw Telegram bot is the **end-to-end experience**: pair in seconds,
  smooth streaming, real status, one-tap approve — not any single capability.

> When evaluating ideas, anything that makes the flow more fluent ranks higher than a new isolated
> feature. If an idea only adds a feature but doesn't serve the flow, it's probably backlog.

## 3. Who it's for (and who it's NOT for)

**Primary:** Technical self-hosters running personal/business agents on Hermes or OpenClaw. Active
in r/openclaw and the Hermes/OpenClaw Discord. Comfortable with API servers, bearer tokens,
self-hosted infra. They **reject templated, mainstream-consumer polish** — they want a tool that
respects that they know what they're doing.

**NOT for:** mainstream consumers (no agent to connect to) · Matrix/E2EE maximalists (philosophical
non-fit) · enterprise/team buyers (not v1).

*Implication for ideas:* features that assume a non-technical user, a team, or a social graph are
almost always wrong for this audience.

## 4. Connection architecture (the hard-won core — see `docs/CONNECTION.md`)

A self-hosted Hermes is **inbound-only** and sits behind NAT, so a phone off home WiFi can't reach
it directly. Making the app a "direct API client" would only work on WiFi and be *harder to set up
than the Telegram bot we replace* — disqualifying.

**Solution: relay-mandatory for MVP, mirroring Telegram's shape.**
- A small **connector sidecar** runs next to Hermes (Hermes can't dial out itself), talks to
  `localhost:8642`, and dials **outbound** to a relay we operate. The app connects to the relay.
  The relay is the meeting point — nothing on the user's network is exposed.
- **Pairing = a 6-digit code.** It is a short-lived, single-use handshake only. Successful pairing
  replaces it with private 256-bit app and connector credentials; the phone keeps its credential
  in Keychain. No host URL or agent API key is needed on the phone.
- **Agent-assisted onboarding (headline path):** the user pastes a prompt to their agent; the agent
  installs its own connector (deterministic one-liner, daemonized as a service) and reads back the
  6-digit code. The agent gives itself a phone.
- **Direct mode (advanced fallback/dev path):** paste a reachable host + API key
  (Tailscale/tunnel/domain). The implementation remains available for development, but it is hidden
  from first-run onboarding for the beta so pairing has one clear path.
- **Bonuses of the relay:** API key never leaves the server; app reads WebSocket (not brittle RN
  SSE); push notifications fall out of the same channel (connection relay = push relay).
- **Production domain:** `summitapp.dev`, with `relay.summitapp.dev` for WebSocket relay traffic,
  `api.summitapp.dev` for pairing/API requests, and `get.summitapp.dev` for the connector installer.

*The one cost:* relay infra to run, and the connector to install (made trivial via agent-assisted
onboarding). Mitigations: thin/self-hostable relay (open-core), direct mode bypasses it.

## 5. Hard constraints (from `FRAMEWORKS.md` — do not propose around these)

**Hermes (v1 target):**
- **One server = one agent.** No multi-agent endpoint; multi-agent = multiple host+key pairs.
- **No file upload** — inline images only (`image_url`). Don't promise file upload.
- **Model field is cosmetic** — the LLM is configured server-side, not chosen per request.
- **Inbound-only API server** (`:8642`); can't dial out (drives the connector design).
- **Runs API is CONFIRMED:** `/v1/runs`, `/{id}` poll, `/{id}/events` (SSE), `/{id}/stop`,
  `/{id}/approval`. Gate the approve UI on the `run_approval` flag in `/v1/capabilities` at runtime.
- Stored responses for `previous_response_id`: max 100 (LRU).

**OpenClaw (connector path built; public-support validation pending):** multi-agent gateway,
**WebSocket-first**, **no REST runs/approval API** (control plane is WS; REST session mgmt tracked
in issue #20934), **has** file upload (images + PDFs), no `/v1/capabilities`. The connector has a
focused relay chat/approval implementation, but do not assume Hermes parity or promise broad
support until real-world beta validation.

## 6. Current scope

**MVP (Phase 1–2, build first):** agent-assisted pairing onboarding · chat with streaming markdown ·
proper markdown rendering (tables/headings/code, partial-stream-safe) · agent status (idle/running/
error) · reply from app · approve/stop actions.

**Phase 2:** relay push notifications now have per-agent modes (all activity / attention only / off)
and privacy-safe tap-to-thread routing; physical-device delivery verification is still required.
Quick-reply from notification · multi-agent (multiple host+key pairs) remain follow-ons.

**Backlog (v2+, don't start until MVP validates):** cross-agent search · "last result" pin per agent
· cost/usage glance · agent-defined status widgets (JSON → card) · broader OpenClaw support · formal
adapter abstraction (build from real cases, not guessed).

## 7. Explicit non-goals (ruled OUT — flag if an idea lands here)

Built-in voice (already native in Hermes/OpenClaw) · reactions, read receipts, typing indicators ·
group chats / multi-human social features · file upload in v1 (Hermes can't) · Matrix/E2EE
privacy-maximalist segment · automatic compatibility with arbitrary new frameworks (the adapter is
manual, not magic).

## 8. Open decisions (live — good territory for PM thinking)

1. **Connection transport sub-decisions:** hosted vs self-host-only relay for v1; when to resurface
   direct mode after beta; E2E encryption vs TLS-to-relay.
2. **Monetization:** open-core (free app + paid hosted relay) vs paid tier vs none — in tension with
   the community's OSS/free preference. Validate appetite before investing.
3. **Community validation:** post in Hermes/OpenClaw Discord to confirm real demand before building.
4. **OpenClaw API shape:** unresearched; don't assume Hermes parity.
5. **Demo/launch plan:** short screen recording — lead with the *flow* (pair → fluid chat → one-tap
   approve), not just markdown.

## 9. Design direction (for grounding feature ideas — full system TBD in `docs/DESIGN.md`)

Three surfaces only: **Connect/Pair · Chat (the main page) · slide-over left Drawer** (new chat,
recent sessions, settings). No tabs, no inbox. Messages are **not bubbles** — only the user's turn
gets a quiet container; the agent's output flows full-width (so markdown/code/approve cards get
room). Feel target: Claude/ChatGPT fluency wearing Linear's operator clothes, with one warm accent
reserved for the human's Approve decision. The signature element is the **Action Request card**
(inline approve/stop on a blocking run).

First-open onboarding uses one static, grayscale welcome composition rather than a feature carousel:
a concise flow-led promise, a compact operator-cockpit preview, and one clear connection action. It
uses the real Summit mark without the blue app-icon field; there are no decorative glows or paging
gestures before account setup.

Pairing is a compact two-step root screen: copy one agent-ready prompt, then enter the returned
six-digit code. It has no back route into the advanced direct-server form, no optional naming field,
and no duplicated installer card; the connected agent supplies its own display name.

Self-serve account creation is available in beta and release builds. Sign-in always offers a route
to create a distinct account; existing users sign in with their existing email rather than deleting
their account. Framework roadmap/status copy is not shown on the welcome screen because it reads
like live connection state and distracts from the first-run action.

## 10. How to judge a new idea (the filter)

Run any proposed feature/product through these. A "no" isn't fatal, but name it:
1. **Audience fit** — does it serve a technical self-hoster, not a mainstream/team/social user?
2. **Constraint-safe** — does it respect Hermes's limits (one-agent, no upload, inbound-only)? If it
   needs something Hermes can't do, say so.
3. **Serves the flow** — does it make the core experience more fluent, or is it an isolated feature?
4. **Differentiates from raw Telegram** — does it do something a dumb chat bot can't?
5. **Right stage** — MVP, Phase 2, or backlog? Don't pull v2 work forward without a reason.
6. **Not a ruled-out non-goal** (§7).

## 11. Source documents (go deeper / keep this current)

| Doc | Holds |
|-----|-------|
| `PRD.md` | Full product spec, scope, phases, risks, open decisions |
| `docs/CONNECTION.md` | Connection architecture, relay, connector, agent-assisted onboarding |
| `FRAMEWORKS.md` | Hermes & OpenClaw API surfaces, constraints, adapter interface |
| `docs/DESIGN.md` | Front-end design system (planned — may not exist yet) |

**Keep-current rule:** when a product decision changes in any source doc, update the relevant section
here in the same pass. A stale brief is worse than no brief — it makes the PM confidently wrong.
