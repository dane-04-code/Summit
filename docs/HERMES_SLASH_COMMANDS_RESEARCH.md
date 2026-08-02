# Hermes Slash Commands & Model Picker — Source Research

Last researched: 2026-07-31, from `NousResearch/hermes-agent` (`main` branch, live GitHub source,
not docs). Companion to `HERMES_MESSAGING_RESEARCH.md`, which covered adapter architecture but not
command behavior in detail.

## Where this lives in the Hermes repo

Platform adapters moved out of `gateway/platforms/` into standalone plugins:

```text
plugins/platforms/telegram/adapter.py   (472 KB)
plugins/platforms/discord/adapter.py    (443 KB)
plugins/platforms/slack/adapter.py      (401 KB) + block_kit.py (markdown-only, no interactive blocks)
```

Command logic (parsing, dispatch, persistence) is shared and platform-agnostic:

```text
gateway/slash_commands.py   (5,483 lines)
gateway/slash_access.py     (tier-gated command access)
```

Each adapter only implements the *rendering* of pickers/buttons; the actual model-switch logic,
persistence, and validation is shared.

## Full command list (from `slash_commands.py`)

| Command | Purpose |
|---|---|
| `/reset`, `/new` | Clear conversation, rotate session ID, fire lifecycle hooks |
| `/profile` | Show which profile/home-dir is serving this chat |
| `/whoami` | Show platform, scope, tier, and which commands you can run |
| `/kanban` | Delegates to shared kanban CLI, auto-subscribes on task creation |
| `/status` | Session id, timestamps, model, context usage, token count, agent state, queue depth |
| `/context` | Deep context-window gauge, compression metrics, per-skill breakdown |
| `/agents` | Active agents, background tasks, async delegations |
| `/stop` | Interrupt running agent, clear typing indicators |
| `/platform` | List connected/failed platform adapters; pause/resume |
| `/restart` | Drain + exit 75 for service-manager restart |
| `/version` | Running Hermes version |
| `/help`, `/commands` | Command reference (paginated per platform) |
| `/model` | **Interactive model/provider switcher** — see below |
| `/reasoning` | Set reasoning effort (off/low/medium/high) — same picker pattern as `/model` |
| `/fast` | Quick toggle to a fast/cheap model — same picker pattern |

The last three all funnel through one shared picker/keyboard component, not three separate UIs.

## `/model`: the feature worth stealing

**Usage:**
- `/model` (no args) → interactive picker
- `/model <name>` → switch for current session
- `--once` → next turn only, auto-restores prior model after
- `--session` (default) → session-only
- `--global` → persists to `config.yaml`
- `--provider <name>` → switch provider, auto-pick a model
- `--refresh` → bypass cache, hit providers live

**Persistence layers**, cleanly separated:
1. Session override map (survives gateway restart via session store)
2. `config.yaml` (only when `--global`)
3. One-shot override snapshot (only when `--once`, restored after next turn)
4. API keys are **never** written to disk — held only in the in-memory override map

**Safety details worth copying:**
- A stale-code guard (`detect_code_skew`) refuses to switch if the running checkout doesn't match
  what's on disk — avoids silently running a half-updated build.
- Failed in-place model swap rolls back to the previously-working model and aborts persistence
  rather than leaving the session half-switched.
- Switching models/providers resets pinned context length unless explicitly configured to carry over.

### The picker UI itself (Telegram — `plugins/platforms/telegram/adapter.py:5555`)

Two-step drill-down, **editing the same message in place** rather than sending new messages each
step:

```text
Tap /model
  → message: "Current model: X | Provider: Y" + inline keyboard of PROVIDERS
  → tap a provider → same message edits to inline keyboard of MODELS for that provider
  → tap a model → same message edits to "✓ Switched to <model>"
```

Concrete mechanics:
- Providers with multiple related models (Kimi/Moonshot, MiniMax, xAI/Grok, ...) **fold into a
  group button** (`mpg:<id>`) that drills into a sub-list, instead of flooding the top level.
- The currently-active provider/model gets a `✓` prefix on its button label.
- Model IDs get shortened (strip vendor path prefix, truncate to 38 chars) so buttons stay legible
  on a phone screen.
- Pagination: 10 providers/page, 8 models/page, with `◀ Prev` / `n/total` / `Next ▶` nav row plus a
  `✗ Cancel` and `◀ Back` row.
- Callback data is a tiny encoded string (`mp:<slug>`, `mm:<index>`, `mpg:<group>`, `mb`, `mx`) —
  state (which providers/models are on screen, session key, the callback to run on selection) is
  kept server-side per chat, not encoded in the button itself.
- Every callback re-checks authorization before mutating state — a picker message left open in a
  shared group chat can't be used by an unauthorized user to flip another session's model.
- Picker state expires — tapping a stale button says "Picker expired — use /model again" rather than
  silently failing.

`/reasoning` and `/fast` reuse a **generic single-level version** of this (`send_choice_picker`,
2 buttons/row, ✓ marks current choice) — so the drill-down component and the flat-list component are
both reusable primitives, not one-off code per command.

## What this means for Summit

Summit already has a real advantage Hermes' chat-bot pickers don't: a native app, not button rows
inside a text thread. We shouldn't clone the Telegram inline-keyboard UI literally — we should steal
the *underlying model*, not the chat-bubble rendering:

1. **A model/provider picker is a proven, wanted feature.** Worth building as a real bottom-sheet or
   modal in Summit (provider list → model list, current one marked, search/filter for long lists)
   rather than a slash command typed into the chat box. This is very likely straightforward against
   Hermes' `/v1/models` REST surface already documented in `FRAMEWORKS.md`.
2. **Copy the persistence model**, not just the UI: session-only vs. global vs. one-shot switch is a
   distinction worth exposing (at minimum session vs. persisted-default), and API keys should never
   be written anywhere Summit doesn't already treat as secret storage.
3. **Copy the safety behavior**: rollback on failed switch, don't leave the session in a half-switched
   state, and reset/flag context implications when the model changes.
4. **The "generic choice picker" pattern is reusable** beyond just models — Hermes uses the identical
   component for `/reasoning` and `/fast`. If Summit adds a reasoning-effort control later, it's the
   same UI component, not new work.
5. Slack's adapter, despite having a full Block Kit renderer, has **no interactive model picker** —
   Slack falls back to a text list. That's a gap in Hermes itself, not a pattern to copy.

## Sources

- Command list: `gateway/slash_commands.py` (NousResearch/hermes-agent, main)
- Telegram picker implementation: `plugins/platforms/telegram/adapter.py` lines 5555–5900+
  (`send_model_picker`, `_build_provider_keyboard`, `_build_model_keyboard`,
  `_handle_model_picker_callback`, `send_choice_picker`)
- Discord/Slack adapters confirmed to exist at `plugins/platforms/{discord,slack}/adapter.py` but not
  deep-read this pass — Discord likely mirrors Telegram's button pattern via its own component API;
  Slack's `block_kit.py` is markdown-rendering only, no interactive picker found.
