# Summit for OpenClaw — Build Plan v2

_Status: extends `OPENCLAW_PLUGIN_BUILD_PLAN.md` (v1), which remains the source of truth for
architecture, distribution, milestones O0–O4, and security requirements. This document is the
OpenClaw counterpart to `HERMES_PLUGIN_BUILD_PLAN_V2.md` — it takes the same "which native features
should Summit surface" exercise and applies it to OpenClaw. **The honest headline: fewer features
transfer directly than Hermes did, because OpenClaw's command model is structurally different.**_

## 1. The scope line, unchanged

Same rule as the Hermes v2 plan: a feature is a candidate only if Summit is *surfacing* something
OpenClaw already does natively, not building new logic in the plugin. See
`PLUGIN_CONNECTION_PLAN.md` §"What we are deliberately not building" and
`HERMES_PLUGIN_BUILD_PLAN_V2.md` §1 — both apply here unchanged.

## 2. Why this isn't a 1:1 port of the Hermes plan

Hermes has one shared, platform-agnostic command dispatcher (`gateway/slash_commands.py`) that every
channel renders the same way. OpenClaw does not have that. Per `docs.openclaw.ai`:

- **No `/model` command exists anywhere in OpenClaw.** Model selection is a per-request HTTP header
  (`x-openclaw-model`, confirmed in `FRAMEWORKS.md`) or static agent config — OpenClaw is
  "model-agnostic" by design, routed server-side, not picked interactively in chat.
- **`/status` exists in the Telegram channel plugin, but means something different** — whether rich
  message formatting is on/off for the session, not agent health/context/tokens. There is no
  Hermes-style `/context` or `/agents` equivalent found in the docs.
- **Commands are channel-plugin-local, not core OpenClaw.** Telegram's command set
  (`/pair`, `/dashboard`, `/activation`, `/reasoning stream`, `/config set`) is defined by the
  Telegram channel plugin itself via `customCommands[]` and Telegram's native command menu
  (`setMyCommands`) — it is not a shared dispatcher other channels automatically get. A Summit
  channel plugin would have to invent its own command set from scratch, which is exactly the
  "logic living in the plugin" the scope line rules out for anything beyond thin surfacing.

This means the Hermes v2 plan's approach — "call Hermes' existing feature, just render it natively"
— only cleanly applies to a couple of things for OpenClaw. Most of the rest either has no native
seam to surface yet, or would require Summit to invent the feature itself (out of scope).

## 3. Feature survey

### Fits — OpenClaw does the work, Summit surfaces it

| Feature | What it gives Summit | OpenClaw seam |
|---|---|---|
| Per-conversation model override | A model picker, functionally — but implemented as Summit remembering the user's chosen model and sending `x-openclaw-model` on requests for that session, not by triggering a native picker (none exists) | `x-openclaw-model` header, confirmed in `FRAMEWORKS.md` |
| Reasoning visibility toggle | Show/hide the agent's live reasoning stream | `/reasoning stream` / `/reasoning on`, confirmed in Telegram channel plugin docs |
| Approval buttons | Tap-to-approve for exec/dangerous actions | `channels.telegram.capabilities.inlineButtons` — confirmed working today in the Telegram channel plugin (see §4) |

### Borderline — plausible, but no confirmed seam yet (needs an O0-style check)

| Feature | Why it's not confirmed |
|---|---|
| Agent health screen (Hermes' `/status`+`/context` equivalent) | No documented OpenClaw endpoint/command surfaces context %, token count, or queue depth. `GET /health/detailed` is a **Hermes-only** endpoint per `FRAMEWORKS.md` — do not assume OpenClaw has a parallel one without checking the Gateway WS control plane |
| Native session reset | No `/reset`/`/new` equivalent found in OpenClaw docs; unclear if the Gateway control plane exposes one to channel plugins |
| Diagnostics (`/whoami`/`/version` equivalent) | Telegram's `/whoami@<bot>` only confirms Telegram user/group IDs — not a general OpenClaw version/capability readout |

### Out of scope — has a native seam, but isn't Summit's job to expose

| Feature | Why not |
|---|---|
| `/dashboard` Mini App (full Control UI as an embedded webview) | This is OpenClaw's own admin surface, not a channel-plugin concern — replicating it would mean embedding someone else's web app, not building a native mobile feature |
| `/config set` / `/config unset` | Gateway configuration control, same category as Hermes' `/platform` — infra, not chat |
| `/activation always` / `/activation mention` | Mention-requirement toggle exists because Telegram is a shared group chat; irrelevant to Summit's 1:1 pairing model |
| `/pair` / `/pair approve` (device-pair plugin) | Not a feature to copy — it's **prior art**. OpenClaw's own pairing flow (roles/scopes, approve-by-request-id) is a useful reference for Summit's pairing design, but Summit already has its own relay-based pairing; don't reimplement OpenClaw's |

## 4. The approval finding worth flagging

`OPENCLAW_PLUGIN_BUILD_PLAN.md` §14 currently says: *"Approval resolution may not have a public
channel-plugin seam. O0 determines whether it ships in the plugin's first release."*

New evidence from OpenClaw's own docs: the **Telegram channel plugin already ships working
inline-button approvals** today (`channels.telegram.capabilities.inlineButtons`, described
explicitly as covering "approval buttons for exec approvals"). That doesn't prove the *same* SDK
surface is exposed to third-party channel plugins like Summit's — but it's a materially stronger
signal than "unproven" that a supported seam exists somewhere in the channel-plugin contract. This
should raise confidence for the O0 spike, not replace it — Telegram may be using a first-party seam
Summit's plugin doesn't have access to. Recommend O0 explicitly checks whether
`inlineButtons`/approval callbacks are available via the public `defineChannelPluginEntry` API or
only to first-party channels.

## 5. Ordering after O4

`OPENCLAW_PLUGIN_BUILD_PLAN.md` ends at O4 (security/packaging/beta). Proposed next sequence,
same "prove need before building" gating as the Hermes plan:

| Phase | Scope | Gate to start |
|---|---|---|
| O5 — Model header wiring | Summit remembers per-session model choice, sends `x-openclaw-model` | O4 beta complete; confirm header is honored per-request vs. only at agent config time |
| O6 — Reasoning toggle | Surface `/reasoning stream`/`on` as an app setting | Cheap, low-risk; can ship alongside O5 |
| O7 — Approval proof | Resolve whether Summit's channel plugin can reach the same inline-button approval seam Telegram uses (§4) | Do this **before**, not after, committing to an approval UI — it's the biggest open unknown in this whole plan |
| Later, unscheduled | Agent health screen, native reset, diagnostics | Only after an O0-style spike confirms OpenClaw exposes the underlying data/command to channel plugins at all |

## 6. Feedback

Plainly: this plan is thinner than the Hermes one, and that's the correct outcome, not a gap in the
research. Three things worth sitting with before treating O5–O7 as committed work:

1. **The headline "model picker" feature doesn't really exist on OpenClaw's side.** What Summit
   would ship is its own remembered-preference-plus-header-override — which is *more* plugin-side
   logic than the Hermes version, and sits closer to the "no model routing in the plugin" line than
   I'm fully comfortable calling clean. Worth a second look before building: is remembering "user
   picked model X for this conversation" and attaching a header routing, or just relaying an
   explicit per-turn choice? I read it as the latter (relaying, not deciding), but it's a judgment
   call, not an obvious yes.
2. **The agent-health and reset features have no confirmed seam at all.** Unlike the Hermes v2 plan
   where I could point at real source code, everything in the "borderline" table here is genuinely
   unknown until someone runs an O0-style spike against a live Gateway. Don't schedule O6+ work
   against them yet.
3. **The approval finding is the one genuinely good piece of news** — worth doing the O7 spike early
   since it de-risks the single biggest open question in the entire OpenClaw plugin plan, Hermes
   parity aside.

My honest read: OpenClaw is worth doing eventually because of its channel breadth, but there's
meaningfully less "free" feature parity to harvest here than there was with Hermes. I'd treat this
whole document as lower-confidence than the Hermes v2 plan until O5–O7 get spiked.

## 7. Sources

- `docs/OPENCLAW_PLUGIN_BUILD_PLAN.md` — v1, architecture/distribution/milestones/security
- `docs/PLUGIN_CONNECTION_PLAN.md` — shared contract and explicit non-goals
- `docs/HERMES_PLUGIN_BUILD_PLAN_V2.md` — Hermes counterpart to this document
- `FRAMEWORKS.md` — OpenClaw API surface (`x-openclaw-model`, no `/v1/capabilities`, WS-first control plane)
- `docs.openclaw.ai/channels/telegram` — confirmed in-chat command list and inline-button capability, fetched 2026-07-31
- `docs.openclaw.ai/help` — confirmed no general in-chat command reference exists outside channel plugins, fetched 2026-07-31
- Verified against `openclaw/openclaw` GitHub repo structure, fetched 2026-07-31
