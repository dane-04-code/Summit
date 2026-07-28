# Summit — Product Brief

*The single source of product truth for the nano product manager. Synthesizes `PRD.md`,
`FRAMEWORKS.md`, and `CONNECTION.md`. When those change, update this. Last synced: 2026-07-21.*

---

## 1. What it is (in one breath)

**Summit** — a React Native (iOS-first, Expo) mobile app that gives people running
self-hosted AI agents (Hermes today, OpenClaw later) a **first-class mobile client** for their
agent: reach it from anywhere, message it fluidly, see its status, and act on blocking decisions
with one tap. Its ambition is to replace Telegram or Discord for the **agent-control job**: the
place a technical self-hoster goes to talk to, monitor, and intervene in their agent from a phone.
It is not a replacement for Telegram/Discord as everyday human messengers.

**Codename:** Summit · **Stage:** Hermes native-plugin alpha and iOS app are ready for a real-device
beta proof; not yet store-ready · **Author:** Dane

## 2. The positioning thesis (memorize this — it's the spine)

**We sell the *flow*, not a feature.** The product is a fast, fluent mobile experience for your
agent. Markdown rendering, push, and approve/stop are *parts* of that experience — the most
*visible* part is proper markdown (raw Telegram mangles tables/code), but **markdown is not the
point; the whole thing feeling first-class is the point.**

**Category ambition:** become the Telegram/Discord replacement for a self-hosted Hermes agent —
not through group-chat breadth, but by making the agent-to-phone loop materially more dependable,
readable, private in its credential handling, and actionable than a generic chat bot. “Telegram
killer” is an internal north star, not a literal public claim or an excuse to build a messenger.

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

**Solution: relay-first, mirroring Telegram's shape.**
- The native **Hermes platform plugin** is now the preferred agent-side connection. It runs inside
  the Hermes gateway and dials **outbound** to the relay we operate; the app connects to that same
  relay. Nothing on the user's network is exposed and the Hermes API key stays off the phone.
- The Go **connector sidecar** remains a working compatibility fallback and the current OpenClaw
  bridge. It is not the recommended Hermes path once native-plugin proof is complete.
- **Pairing = a 6-digit code.** It is a short-lived, single-use handshake only. Successful pairing
  replaces it with private 256-bit app and connector credentials; the phone keeps its credential
  in Keychain. No host URL or agent API key is needed on the phone.
- **Agent-assisted onboarding (headline path):** the user asks their agent to install/enable the
  Summit Hermes plugin, then enters the 6-digit code it provides. The agent gives itself a phone.
- **Direct mode (advanced fallback/dev path):** paste a reachable host + API key
  (Tailscale/tunnel/domain). The implementation remains available for development, but it is hidden
  from first-run onboarding for the beta so pairing has one clear path.
- **Bonuses of the relay:** API key never leaves the server; app reads WebSocket (not brittle RN
  SSE); push notifications fall out of the same channel (connection relay = push relay).
- **Production domain:** `summitapp.dev`, with `relay.summitapp.dev` for WebSocket relay traffic,
  `api.summitapp.dev` for pairing/API requests, and `get.summitapp.dev` for the connector installer.

*The one cost:* relay infrastructure to run and an agent-side integration to enable. The native
Hermes plugin has reached alpha; the connector remains a compatibility path. Mitigations:
thin/self-hostable relay (open-core), direct mode bypasses it.

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

## 6. Current V1 scope

**Now:** connection is no longer the leading uncertainty. Finish chat display and the safe,
user-facing output that comes from real agent harnesses: streamed response text, compact activity,
settled reply recovery, and one proactive cron/result proof. The native Hermes plugin already
provides the first three. Add a typed `cron_run` summary only if that real test needs it; do not
expand into arbitrary plugin UI, raw logs, or a dashboard before release.

**One output contract:** every transport produces the same durable, copyable markdown conversation.
The native Hermes plugin may enrich a live turn with trusted, ephemeral activity and route an
asynchronous result back to the correct session; it must not create a separate transcript format or
an exposed tool trace. This keeps the baseline excellent for relay/connector users while making the
native path calmer and more dependable.

**Event disclosures:** Summit may use one app-owned, collapsed-by-default disclosure pattern for
typed operational facts that earn context beyond a one-line notice. The first V1 use is the
background-completion receipt (“Finished while you were away”); later fixed kinds may cover a
scheduled run or a supported approval. Expanding reveals only the bounded fields Summit defines
(for example outcome, time, duration, and a link to the owning thread), never arbitrary plugin UI,
raw tool output, chain-of-thought, paths, or command arguments. The durable agent answer remains
ordinary Markdown beside it.

**Scheduled-work contract:** the Cron tab is the canonical, consistent view of an agent's scheduled
jobs. For every supported Hermes transport it must load all available jobs and their useful state
(schedule, enabled/running state, next run, last result/status, and safe controls). Chat is where a
particular completed result is delivered, not where users manage their schedule. Native-plugin Jobs
API parity is therefore a V1 requirement; do not call Cron complete until that bridge is proven.

### Native-plugin quality plan (the next five multipliers)

**Decision:** the native plugin is Summit's *quality and continuity layer*, not a channel for
inventing a second UI or transcript. It may provide facts that only the agent host knows — native
turn ownership, safe lifecycle state, settled delivery, scheduled work, and supported control
requests. The phone owns presentation; all durable replies remain the same copyable Markdown for
every transport.

1. **Truthful live-turn status — V1 polish, build now.** A quiet, unboxed shimmering status line
   should show only the current safe label—such as “Searching the web…” or “Reading files…”—as
   Hermes actually changes tools. It must deduplicate repeated events, never reveal reasoning,
   commands, paths, arguments, or tool output, and disappear into the final answer. The moving text
   gives a technical user proof of progress without recreating a terminal or a second message card
   on a phone. The plugin emits the trusted event; prove the exact real-device presentation before
   calling the V1 flow finished.
2. **Authoritative final-answer repair — V1 release gate, build now.** Hermes can revise a streamed
   draft at a tool boundary. The plugin must send the settled final answer with the terminal event,
   and Summit must replace a superseded draft before persisting it. This is not a decorative
   enhancement: showing an old partial answer destroys trust in the core product. The protocol and
   reducer are implemented; test a real revised turn and restart recovery before release.
3. **Calm background completion — V1 release gate, build now.** When a user locks or kills the app,
   the host keeps the turn alive, durably records the settled reply, and returns it to the owning
   thread exactly once after reconnect. The app may show a small “finished while you were away”
   state and use the existing notification policy, but it must not manufacture a second system
   message or treat phone silence as a failed run. This is the plugin advantage users feel every
   day versus a brittle bot.
4. **Scheduled-work home — V1 proof, next.** The Cron tab remains the management surface; the
   plugin's host-only, allow-listed Jobs API bridge supplies all jobs and safe controls. The
   documented `summit-home` target resolves to a private per-agent **Scheduled work** thread; a
   content-free relay nudge makes the app sync the durable Markdown result into that thread. Do not
   add a raw log flood or a duplicate job editor in chat. Add a compact typed `cron_run` summary
   only if the real test shows ordinary settled Markdown is not scannable enough. Prove a real
   schedule end-to-end, including a failed run and a paused job. The native plugin must support
   both gateway-owned and separate-process cron delivery through the same owner-only reply outbox.
5. **Native intervention requests — Phase 2 proof, not a release blocker.** When Hermes exposes a
   stable native approval/stop event with a run ID, the plugin can send a typed action request so
   Summit renders one-tap approve/deny/stop controls. Until that integration is proven and the
   runtime `run_approval` capability says it is available, keep the existing exact-command fallback.
   Do not infer approvals from prose or send arbitrary host commands through the relay.

**Explicitly not in this plan:** raw tool transcripts, chain-of-thought, agent-defined arbitrary
widgets, a chat-based cron editor, social presence, and a generic plugin marketplace. Each would
make Summit busier without strengthening the agent-to-phone flow.

**MVP (Phase 1–2, build first):** agent-assisted pairing onboarding · chat with streaming markdown ·
proper markdown rendering (tables/headings/code, partial-stream-safe) · agent status (idle/running/
error) with quiet, structured operational activity during long tool work (never chain-of-thought) ·
auto-growing mobile composer with OS speech-to-text dictation · reply from app · approve/stop
actions. Hermes text-fallback approval prompts render as one-tap native action grids while Hermes
continues to own policy and command resolution. Relay turns are server-owned: phone-side silence
must not declare a live turn failed.

**Phase 2:** relay push notifications now have per-agent modes (all activity / attention only / off)
and privacy-safe tap-to-thread routing; physical-device delivery verification is still required.
Background continuity is server-owned, not phone-owned: the connector and relay keep the agent
reachable while iOS suspends Summit, and the app is woken only by push/tap/reopen. A foreground
WebSocket must never be treated as the durable worker. Quick-reply from notification · multi-agent
(multiple host+key pairs) remain follow-ons.

**Backlog (v2+, don't start until MVP validates):** **Summit Artifacts** — private, versioned,
agent-built micro-tools that live with the agent that created them; begin with a constrained native
artifact canvas and gate arbitrary web code behind a security/App Store feasibility spike ·
cross-agent search · "last result" pin per agent · cost/usage glance · agent-defined status widgets
(JSON → card) · broader OpenClaw support · formal adapter abstraction (build from real cases, not
guessed).

**Connection packaging direction (active beta work):** the native Hermes channel plugin is now an
implemented alpha in the separate `../Summit-Hermes/` working copy: it has native session routing,
draft streaming, safe activity, reconnect, and durable reply replay. Validate it on real hosts and
real devices before making it the public default. Ship Hermes first, then OpenClaw. The OpenClaw
TypeScript channel package remains a separate SDK-proof foundation. Keep the Go connector as the
working compatibility fallback until the native plugins pass that proof; do not build a broad
speculative plugin feature list before the core loop validates.

**Agent profile direction:** Summit has an app-owned pushed Agent Profile surface, opened from the
chat header. It shows paired identity and verified capability data now; a later native-plugin
profile snapshot may add bounded skill/tool metadata (name and short summary only). The plugin
never supplies layout, raw skill instructions, system prompts, tool arguments, host paths, or tool
output. A compact chat link may open this same surface, but the profile is not a new dashboard or
second transcript.

**Team-role direction:** Hermes remains one paired Summit agent. If a user has assembled a “team,”
the native plugin may provide a bounded list of verified roles/skills for an app-owned Team card;
tapping a role opens its own role-detail sheet. Roles are not presented as independently paired
servers, and the plugin supplies only a name, short purpose, and safe declared capabilities.

## 7. Explicit non-goals (ruled OUT — flag if an idea lands here)

Voice conversations and agent audio replies (already native in Hermes/OpenClaw; lightweight composer
dictation is in scope) · reactions, read receipts, social typing indicators ·
group chats / multi-human social features · file upload in v1 (Hermes can't) · Matrix/E2EE
privacy-maximalist segment · automatic compatibility with arbitrary new frameworks (the adapter is
manual, not magic).

## 8. Open decisions (live — good territory for PM thinking)

1. **Connection transport sub-decisions:** hosted vs self-host-only relay for v1; when to resurface
   direct mode after beta; E2E encryption vs TLS-to-relay.
2. **Monetization:** open-core (free app + paid hosted relay) vs paid tier vs none — in tension with
   the community's OSS/free preference. Validate appetite before investing.
3. **Community validation:** post in Hermes/OpenClaw Discord to confirm real demand before building.
4. **Native approval proof:** Hermes and OpenClaw expose native messaging/plugin surfaces, but the
   supported in-process path for resolving structured mobile approvals still requires a proof spike;
   the shipped Hermes fallback sends only the exact slash commands the agent already offered.
5. **Demo/launch plan:** short screen recording — lead with the *flow* (pair → fluid chat → one-tap
   approve), not just markdown.
6. **Plugin release gate:** native plugins become the public onboarding path only after they match
   the connector's pairing, background replay, reconnect, and control reliability in real tests.

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
