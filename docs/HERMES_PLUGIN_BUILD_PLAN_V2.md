# Summit for Hermes — Build Plan v2

_Status: extends `HERMES_PLUGIN_BUILD_PLAN.md` (v1), which remains the source of truth for the
already-built foundation (native platform registration, relay pairing, draft streaming, safe
activity, reconnect, durable settled-reply replay — status as of 2026-07-21). This document covers
what comes **after** that foundation: which Hermes-native features are worth surfacing in Summit,
in what order, and the scope line that keeps this from turning into a feature-catalogue project._

## 1. The scope line (read this before adding anything)

Two existing docs already answered "can we add whatever we want":

- `PLUGIN_CONNECTION_PLAN.md` §"What we are deliberately not building": **no model/provider
  routing, agent tools, shell execution, or billing** inside the plugin. Hermes already owns that
  logic — the plugin's job is transport, pairing, and rendering, not reimplementing agent behavior.
- `HERMES_PLUGIN_BUILD_PLAN.md` §1: warns against "a broad protocol v2 or a catalogue of plugin
  features." Add a typed event only after a real device test shows the current primitives
  (text/activity/replay) can't present something that matters.

Technically the plugin runs in-process with Hermes and has the same reach as the Telegram/Discord/
Slack adapters — nothing stops us from wiring up anything Hermes exposes. The constraint is
deliberate, not a platform limitation. Every feature below is filtered through that line.

**Rule for this doc:** a feature is only a candidate if Summit is *surfacing* something Hermes
already does natively (its own slash-command dispatch, its own model switching, its own approval
flow). If it requires new logic living in the plugin instead of a call into Hermes, it's out of
scope, full stop.

## 2. Feature survey (source: `HERMES_SLASH_COMMANDS_RESEARCH.md`)

Pulled from Hermes' actual `gateway/slash_commands.py` command list, filtered against the scope
line above.

### Fits — Hermes does the work, Summit only needs to surface it

| Feature | What it gives Summit | Hermes seam |
|---|---|---|
| `/model` (+ `/reasoning`, `/fast`) | Native model/provider picker, session vs. global vs. one-shot switching | Shared choice-picker component; see §3 |
| `/status` | Session id, timestamps, model, context %, token count, agent state, queue depth | Text command, parseable |
| `/context` | Deep context-window gauge, compression metrics, per-skill breakdown | Text command, parseable |
| `/agents` | Visibility into active background/async delegated work | Text command, parseable |
| `/stop` | Interrupt the running turn | Already mapped — `HERMES_PLUGIN_BUILD_PLAN.md` §E |
| Draft streaming + tool lifecycle | Live growing response, collapsed tool rows | Already built (H1/H2) |
| Cron/proactive delivery | Scheduled job results pushed to phone | Already built, being proven on-device now |
| `/whoami` + `/version` | About/diagnostics screen — platform, tier, running Hermes version | Text commands, parseable; matches the "connection diagnostics" need called out in `HERMES_MESSAGING_RESEARCH.md` |
| `/reset` / `/new` | Native session reset (rotates session ID, fires lifecycle hooks) instead of a local-only "new chat" | Text command; needs an audit — see §3.5 |

### Borderline — real UX wins, blocked on an unproven Hermes seam

| Feature | Why it's not free yet |
|---|---|
| Native approval resolution (not typed `/approve`/`/deny`) | `HERMES_PLUGIN_BUILD_PLAN.md` §E: "must not fake a universal mapping" — needs H0-style proof of the actual callback contract |
| Reactions-as-quick-actions (Matrix pattern: react to approve/pick) | No confirmed Summit-side seam; Matrix-specific pattern, not guaranteed on Hermes' generic platform interface |
| Rich attachments (`MEDIA:` convention) | Plan already states Hermes has no general file upload — inline images only |

### Out of scope — crosses the line in §1

| Feature | Why not |
|---|---|
| `/kanban` | Task-management surface, not a channel/transport concern |
| `/platform` (pause/resume adapters) | Infra control, not a mobile chat concern |
| Any model/provider switching logic implemented *inside* the plugin | Explicitly forbidden — must call Hermes' existing `/model`, never reimplement routing |

## 3. First candidate, spec'd: the model picker

This is the most concrete "fits" item and the one to build next after the current on-device proof
work lands. Full source detail in `HERMES_SLASH_COMMANDS_RESEARCH.md`; summarized here as a spec.

**What Hermes already provides** (`gateway/slash_commands.py`, `plugins/platforms/telegram/adapter.py`):

- Three persistence tiers: session-only (default), `--once` (auto-restores next turn), `--global`
  (writes `config.yaml`). API keys are never persisted to disk.
- Rollback on failed switch — never leaves a session half-switched.
- A reusable "choice picker" primitive already shared by `/model`, `/reasoning`, and `/fast`.
- Provider grouping (related providers fold into one entry) and a "current selection" marker.

**Correction (built 2026-07-31):** this section originally proposed building against Hermes'
`/v1/models` REST surface. That endpoint is the wrong seam — it lists connected *agent profiles*,
not provider models (see `FRAMEWORKS.md` line 112). The real seam is `send_model_picker`, an adapter
hook Hermes calls in-process: when `/model` runs with no arguments, `gateway/slash_commands.py`
checks whether the adapter defines it and, if so, hands over the provider list (already filtered to
credentials the host holds) plus an `on_model_selected` callback that performs the switch.

**What Summit built:** the plugin implements `send_model_picker` and relays that payload to the
phone as four new frames (`models_req`/`models`, `model_select`/`model_result`), gated on a
`model_picker` capability advertised in `hello` so an older connector is never sent a frame it would
reject. The app renders a native bottom sheet — provider groups, current model marked, session vs.
persisted-default scope — from the composer's model chip.

**Explicitly not doing:** no client-side model list caching/validation logic, no provider
credential handling in the plugin — the picker calls into Hermes' existing switch path and displays
what comes back. A selection is only forwarded when it appears in the list Hermes just supplied, and
a switch Hermes refuses or rolls back is reported as a failure rather than as a change.

## 3.5. Resolved: "new chat" is already a real Hermes session boundary

Audited 2026-07-31 — **no gap, no fix needed.** `handleNewChat` (`src/app/(app)/index.tsx`) drops
the session ref; the next message runs `ensureSession`, which mints a fresh session id. That id
travels as the relay frame's `sessionId`, and the plugin uses it verbatim as the Hermes
`SessionSource.chat_id` (`summit_hermes/platform.py`). Hermes keys sessions by chat id, so a new
Summit thread is a new Hermes session — it does not inherit the previous thread's context.

What a native `/reset` would add beyond this is only the lifecycle-hook firing on the *old* session,
which nothing currently depends on. Not worth a round trip.

## 4. Ordering after the current milestone (H4)

`HERMES_PLUGIN_BUILD_PLAN.md` ends at H4 (security/packaging/beta). This is the proposed next
sequence, gated the same way: don't start the next row until a real device test justifies it.

| Phase | Scope | Gate to start |
|---|---|---|
| ~~H5a — Reset audit~~ | **Done 2026-07-31** — audited, no gap (§3.5) | — |
| H5b — Diagnostics screen | `/whoami` + `/version` surfaced as an about/diagnostics screen | Cheap, low-risk; can ride along with H5a |
| ~~H5 — Model picker~~ | **Built 2026-07-31** — `send_model_picker` in the plugin, four relay frames, composer chip + bottom sheet, session/default scope. Unit-tested; **not yet run against a real Hermes gateway or on a device** | — |
| H6 — Agent health screen | `/status` + `/context` surfaced as a real screen (context %, tokens, queue) | A real beta tester asks "is it stuck / how full is context" — don't build speculatively |
| H7 — Approval proof | Resolve the actual native approval callback contract (H0-style spike), then wire it | Only after typed `/approve` fallback has shipped and been used |
| Later, unscheduled | Reactions-as-quick-actions, rich attachments | Only if Hermes upstream proves the seam exists for Summit's adapter type |

## 5. Sources

- `docs/HERMES_PLUGIN_BUILD_PLAN.md` — v1, current build status and architecture
- `docs/PLUGIN_CONNECTION_PLAN.md` — shared Hermes/OpenClaw contract and explicit non-goals
- `docs/HERMES_SLASH_COMMANDS_RESEARCH.md` — full command list and `/model` picker source detail
- `FRAMEWORKS.md` — Hermes REST surface (`/v1/models`, etc.)
- Verified against `NousResearch/hermes-agent` `main` branch, `gateway/slash_commands.py` and
  `plugins/platforms/telegram/adapter.py`, fetched 2026-07-31
