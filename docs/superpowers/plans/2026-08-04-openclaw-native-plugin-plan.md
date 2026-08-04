# Summit for OpenClaw — native plugin plan

**Status:** research + plan only. Nothing built. Written after a full pass through
the actual OpenClaw plugin SDK docs (installed package: `openclaw@2026.6.11`,
`~/AppData/Roaming/npm/node_modules/openclaw/docs/`) and its bundled Telegram/
Discord channel plugins, which Dane asked to be used as the feature bar.

**Audience:** whoever picks this up to actually build it. Read the "Source of
truth" section, then the feature catalog, then the phasing. Don't re-derive the
SDK research — it's cited inline with file paths into the installed package.

## The ask, restated

Summit already has a working OpenClaw integration via the Go connector
(`connector/openclaw.go` — chat, push approvals, jobs/cron, all committed this
session). Dane wants a **native OpenClaw plugin**, the same shape as
`SummitAI-app/Summit-Hermes`, that:

1. Works standalone — a user who never installs it still gets the full
   connector experience. Nothing regresses.
2. When installed, makes OpenClaw "ten times better" — richer than what the
   connector can ever offer, because it runs *inside* OpenClaw instead of
   polling it from outside.
3. Matches the bar OpenClaw itself sets for its best first-party channels
   (Telegram, Discord) — native buttons, live status, reactions, approvals,
   not just text in/text out.

## Source of truth

- OpenClaw plugin SDK docs: `docs/plugins/architecture.md`,
  `building-plugins.md`, `sdk-channel-plugins.md`, `hooks.md`,
  `plugin-permission-requests.md`, `message-presentation.md` (all in the
  installed `openclaw` npm package, not this repo).
- Reference bar: `docs/channels/telegram.md`, `docs/channels/discord.md` in
  that same package — what OpenClaw's own best channels actually do.
- Summit's existing OpenClaw connector work: `connector/openclaw.go`,
  `connector/main.go`, `docs/superpowers/plans/2026-07-06-openclaw-next-steps-handoff.md`.
- Summit-Hermes (the precedent to match/exceed): `SummitAI-app/Summit-Hermes`
  on GitHub — Python, installs into Hermes via `hermes plugins install`, opens
  its own outbound `wss://` to the relay, no secret leaves the host.
- **Already built and waiting for this**: `protocol/protocol.ts` defines
  `ConnectionVia = 'connector' | 'plugin'`, threaded through the relay
  (`relay/src/logic.ts`), the app's agent state (`src/agents/types.ts`), and
  the pairing screen (`src/app/(app)/pair.tsx:98`). Summit-Hermes already
  sends `via: 'plugin'`. **The app already knows how to tell a native plugin
  apart from the connector fallback and can show that in the UI today.** This
  plan doesn't need to invent that distinction — it needs to use it.

## Architecture

A native OpenClaw plugin is a **channel plugin** (`docs/plugins/sdk-channel-plugins.md`),
OpenClaw's term for "connects OpenClaw to a messaging platform" — the same
category as Telegram, Discord, Slack, iMessage. Concretely:

- **Language/runtime:** TypeScript/Node ESM (OpenClaw's own stack), not Python.
  Different from Summit-Hermes.
- **Distribution:** a new repo, `Summit-OpenClaw` (or similar) under
  `SummitAI-app`, published to ClawHub / npm. Installed with
  `openclaw plugins install clawhub:SummitAI-app/summit-openclaw` (or the npm
  bare-spec form during ClawHub's launch cutover).
- **Runs in-process** with the OpenClaw Gateway (`docs/plugins/architecture.md`
  "Execution model") — not sandboxed, same trust level as core OpenClaw code.
  It opens its own outbound `wss://` connection to Summit's relay, exactly like
  Summit-Hermes. No local port, no token copy-paste into the phone.
- **No separate WS-to-localhost-Gateway hop.** The Go connector today dials
  `ws://localhost:18789` from *outside* OpenClaw and re-implements the
  operator handshake. A native plugin skips that whole layer — it *is* inside
  the process, so it reads config, sessions, and cron state directly through
  the plugin API instead of the Gateway's operator RPC surface. One fewer
  moving part, one fewer reconnect loop.
- **Manifest** (`openclaw.plugin.json` + `package.json` `openclaw.channel`
  block) declares `channel.id: "summit"`, config schema (just the relay URL
  override + state dir, mirroring Summit-Hermes's env vars), and which
  contracts it uses (`contracts.tools`, hooks, etc.).
- Entry point via `defineChannelPluginEntry` (`docs/plugins/building-plugins.md`,
  `sdk-channel-plugins.md`), built on `createChatChannelPlugin` from
  `openclaw/plugin-sdk/channel-core`.

## Non-negotiable: the connector stays the floor

Nothing in this plan removes or weakens `connector/openclaw.go`. The
capability model already exists for exactly this (`src/agents/frameworks.ts`,
`defaultCapabilitiesFor`) — it's additive per framework/via combination, never
subtractive. Today `openclaw` via `connector` gets: chat, push approvals
(deny-as-stop), jobs/cron (just built). A plugin-equipped OpenClaw should
report `via: 'plugin'` and light up **more** capability flags on top of that
same floor — it should never be a fork the connector path has to keep up
with. Anyone who never installs the plugin keeps exactly what they have today.

## Feature catalog — what the plugin unlocks

Organized by what it actually changes for the person holding the phone, each
one grounded in a concrete OpenClaw SDK surface (not speculation) and compared
to what the connector can/can't already do.

### Tier 1 — direct upgrades to things Summit already has

| Feature | Connector today | With the plugin | OpenClaw surface |
|---|---|---|---|
| Approvals | Push-based, but only `deny`/`allow-once` (the "stop" button just denies) | Full native approval card: title, description, **severity** (info/warning/critical — Telegram/Discord render this as color), `allow-once` / `allow-always` / `deny`, timeout with configurable timeout behavior | `docs/plugins/plugin-permission-requests.md` — `requireApproval` on `before_tool_call`, `approvalCapability` |
| Approval delivery | Text-only push, app builds its own card locally | `MessagePresentation` — real buttons rendered natively, with graceful degrade to text if ever needed | `docs/plugins/message-presentation.md` |
| Tool/activity visibility | One generic "Thinking…" label, no idea what's actually running | Structured per-tool status: `before_tool_call`/`after_tool_call` hooks see the actual tool name, params, and duration — could push "Running web_search: 'weather in sf'" instead of a static label | `docs/plugins/hooks.md` §Tools |
| Cron/job updates | App must poll `cron.list`/`cron.get` through the connector | `cron_changed` hook fires on `added/updated/removed/started/finished/scheduled` — push a proactive notification the instant a job finishes, not on next poll | `docs/plugins/hooks.md` §Lifecycle |
| Install friction | `OPENCLAW_TOKEN`/`OPENCLAW_WS_URL` auto-detected by the install script, but still a second process to run/restart | Plugin reads OpenClaw's own config directly — `openclaw plugins install`, restart gateway, get a pairing code. One command, matches Hermes plugin install flow exactly | `docs/plugins/building-plugins.md` install flow |

### Tier 2 — real new capability, currently just a dormant flag

| Feature | Status today | What the plugin could back it with |
|---|---|---|
| `hasSessions` | Hardcoded `false` for OpenClaw (and dormant even for Hermes — no real UI consumes it yet) | `session_start`/`session_end` + `subagent_spawned`/`subagent_ended` hooks give real visibility into multiple concurrent sessions/sub-agent runs. This is the first framework where "Sessions" could become a real feature instead of a settings-screen label — worth scoping a matching mobile UI alongside it, not building blind |
| Live status draft (separate from final answer) | Summit gets raw token chunks only | Telegram/Discord's `streaming.mode: "progress"` pattern: one editable status line ("Editing 3 files…") that updates in place and clears on completion, distinct from the final answer bubble — cleaner mobile read than interleaved chunks |
| Multi-agent / sub-agent awareness | None | `subagent_spawned` includes `resolvedModel`, `resolvedProvider`, `childSessionKey` — could surface "spawned a sub-agent to do X" as a real UI element instead of silent |

### Tier 3 — parity with what Telegram/Discord users already get from OpenClaw

Direct feature-matching against `docs/channels/telegram.md` and
`docs/channels/discord.md`, since that's the bar Dane pointed at:

- **Reactions as delivery/read signal** — Telegram/Discord get an "ack" emoji
  reaction the moment OpenClaw starts processing a message
  (`ackReaction`/`ackReactionScope`). A Summit-side equivalent (a delivered/
  seen indicator in the chat UI) is a small, real polish win.
- **Rich formatting fidelity** — OpenClaw already renders Markdown through its
  own IR into channel-native rich text. Confirm Summit's own markdown
  renderer (already a "most visible upgrade" per `CLAUDE.md`) is receiving
  the same clean text a plugin would get, not something the connector's
  raw-chunk path degrades.
- **Approval severity/urgency coloring** — see Tier 1; call out separately
  because Telegram/Discord's whole approval UX leans on this and Summit's
  card design should too.
- **Native "pin"** (`ReplyPayloadDelivery.pin`) — not obviously useful on a
  phone chat UI, but worth a quick "does this map to anything" pass, since
  it's free once `MessagePresentation` is wired.

### Explicitly not chasing

Telegram/Discord also have: voice channels, stickers, forum-topic threading,
inline mini-apps, presence status, moderation actions (kick/ban/timeout),
polls. None of that maps to what Summit is (`CLAUDE.md`: "the product sells
the *flow*... not any single feature") — a mobile operator cockpit, not a
group-chat platform. Skip these; including them would be scope creep in the
literal sense Dane's own product docs warn against.

## Phasing

Mirrors how Summit-Hermes shipped (alpha: chat, sessions, streaming, reconnect,
durable offline recovery — explicitly *not* rich attachments or native
approval cards in its first release) and how the OpenClaw connector itself was
staged (chat first, then approvals, now jobs):

1. **Phase 1 — chat parity, `via: 'plugin'`.** Package skeleton, manifest,
   `defineChannelPluginEntry`, outbound `wss://` to Summit's relay, chat
   round-trip. Prove the app already treats `via: 'plugin'` correctly (it
   should — `pair.tsx` already reads it) before adding anything the connector
   doesn't have.
2. **Phase 2 — native approvals.** `requireApproval` + `MessagePresentation`
   cards with severity. This is the first real "10x" moment — same underlying
   capability as the connector's push approvals, materially better UX.
3. **Phase 3 — structured tool/activity visibility.** `before_tool_call`/
   `after_tool_call` hooks → typed activity events instead of "Thinking…".
   Directly serves the V1 priority already in `docs/PROJECT_STATUS.md`
   ("turn the already-available harness signals into calm operational
   context").
4. **Phase 4 — event-driven cron delivery.** `cron_changed` hook → push
   notification on job completion. Directly serves the other named V1
   priority ("deliver one real scheduled/cron outcome... notify the user").
5. **Phase 5 (needs its own scoping pass, not blind building) — sessions.**
   Only once there's an actual mobile UI plan for what multi-session
   visibility should look like. Don't wire the hook before there's a screen
   for it.

Each phase needs the same live-Gateway validation discipline as the connector
work: build against the documented SDK contract, then confirm against a real
running OpenClaw Gateway before calling it done. Fixture/schema-accurate is
not the same as live-verified.

## Build log

### Phase 1 — built (2026-08-04). Chat parity, `via: 'plugin'`.

Lives at `openclaw-plugin/` in this repo, published from there as
`summit-openclaw`. It sits alongside `relay/` and `connector/` as a nested
package with its own `node_modules`, vitest and tsconfig, excluded from the root
jest/tsconfig. 34 unit tests, `tsc --noEmit` clean, esbuild bundle builds.

**The first open question below is resolved: it is a real channel plugin, not a
runtime-context bridge.** The deciding fact is that
`runtime.channel.inbound.run(...)` is the only supported way to hand a message
to the agent and get a routed, session-recorded, hook-observed reply back —
`webhooks`/`admin-http-rpc` would mean re-implementing dispatch, which is the
exact thing the connector already does badly from outside. The chat-platform
trappings turned out to be cheap to decline rather than expensive to satisfy:
`security.dm` and `pairing.text` are both **omitted entirely**, because the relay
already refuses to forward an app frame until that device presents the session
token minted at pair time (`relay/src/logic.ts`). Authorization lives one layer
below the channel; a second allowlist in the plugin would be theatre.

What was built:

- `src/relay-client.ts` — outbound `wss://` speaking `protocol/protocol.ts`,
  `via: 'plugin'` in the hello, `code_rotation`, channel reclaim across
  restarts, 30s JSON heartbeat (Cloudflare ignores WS control pings).
- `src/bridge.ts` — `chat` frame → `runtime.channel.inbound.run` → delivered
  blocks emitted as `chunk`, settled as `done`/`error`. One turn per
  conversation; the app's `sessionKey`/`sessionId` *is* the conversation id, so
  one Summit thread is one OpenClaw session.
- `src/outbox.ts` — port of `connector/outbox.go`. Included in Phase 1
  deliberately: without it `sync_req` goes unanswered and offline recovery
  regresses against the connector floor, which the plan forbids.
- `src/channel.ts` — the channel object, import-cheap (no clients), reaching the
  live connection through a module-level holder in `src/runtime.ts`.

Wire-contract drift is structurally prevented rather than policed:
`src/protocol.ts` is `export type *` from `protocol/protocol.ts` and the
pairing-code helpers are imported directly, with esbuild inlining both at
publish time.

Notes for Phase 2+:

- **Not live-verified.** Everything is contract-accurate against the installed
  `openclaw@2026.6.11` typings and proven against a faked runtime. It has not
  run against a real Gateway, and per this plan's own discipline that is not the
  same as done. A first real-Gateway run is the gate on calling Phase 1
  finished.
- The app needed **no changes**: `via` is already read at `pair.tsx:98`,
  persisted in `src/db/sqlite.ts`, and consumed at `src/app/(app)/index.tsx:257`
  to suppress the "install the plugin" nudge. Phase 1 lights that path up by
  sending the flag, nothing more.
- `defaultCapabilitiesFor` in `src/agents/frameworks.ts` is still keyed on
  framework alone, not `(framework, via)`. Phase 2 is the first phase that needs
  a capability the connector doesn't have, so that is where the `via` dimension
  should be added — not before.
- `createChannelPluginBase` widens its optional surfaces back to `| undefined`,
  so `createChatChannelPlugin` cannot see that `capabilities`/`config` were
  supplied. `src/channel.ts` re-narrows with a documented assertion. If a later
  SDK release fixes the typing, delete it.
- The 15s `activity: "Thinking…"` heartbeat is a placeholder that matches the
  connector exactly. Phase 3 replaces it with real tool names from
  `before_tool_call` — that is the whole point of Phase 3.

## Open questions for whoever builds this

- **Resolved (Phase 1, see build log):** exact `registerChannel`/`ChannelPlugin` adapter surface needed for a
  "backend bridge to our own relay" channel (not a normal DM/group chat
  platform) isn't fully nailed down here — `createChatChannelPlugin` assumes
  DM security/pairing/threading concepts (allowlists, group policy) that
  don't map cleanly onto "one operator's own phone talking to their own
  agent." Needs a design pass against the SDK before Phase 1 starts: does
  Summit's channel plugin even need `security.dm`/`pairing.text`, or can it
  skip straight to a runtime-context WS bridge like `webhooks`/`admin-http-rpc`
  (simpler bundled extensions, no chat-platform trappings)?
- Repo/publishing: new `SummitAI-app/Summit-OpenClaw` repo, ClawHub package
  registration — real setup work, not just code.
- Should the plugin's outbound relay connection reuse Summit-Hermes's
  connection code/patterns at all, or are they independent because the
  languages differ (Python vs TS)? Probably independent; note it so nobody
  assumes shared code that doesn't exist.
