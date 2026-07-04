# Slash Commands — Design

*2026-07-04*

## Goal

Let a user type `/` in the composer and get a filtered menu of commands —
Claude Code-style live filtering — covering both **app actions** (handled
locally) and **agent commands** (sent to the agent as text). Pure client-side
UI: no relay, connector, or agent changes.

## Background — the key decision

Telegram bots register a command list with the platform (`setMyCommands`) and
the Telegram client renders the `/` menu. **We have no equivalent**, because we
are not behind a gateway — Summit talks straight to the agent's
OpenAI-compatible API and *is itself the platform adapter*. There is no server
endpoint that will ever hand us a command list.

That turns out not to matter, because of one fact confirmed with Hermes: **the
`/` is just text.** The agent parses `/cron …` on its own and runs the matching
tool; the client sends it like any other message. So a slash command needs no
registry, no `/v1/skills` call, and no agent-side change — it is either a local
app action or a literal string we send.

**Multi-framework consequence.** Summit targets more than Hermes (the Tier 2
generic OpenAI floor — Ollama, LM Studio — via `openai.ts`). A generic model
has no cron tool and will not "run" `/cron`; it just sees text. So commands
split by reach:

- **App commands** (`/new`, `/clear`, `/settings`) — handled in the app, never
  sent. Work on every agent, always.
- **Agent commands** (`/cron`) — sent as literal text; only meaningful on an
  agent that implements them. Surfaced only when the agent's capabilities say
  so — the same capability-gating the app already uses (`hasJobs` gates the
  Cron sidebar item; features flow from `agent.capabilities`).

A generic agent therefore sees a clean menu of just the app commands — no dead
entries, consistent with the "clean messaging floor, no dead chrome" principle.

## Scope (v1)

Command set (approved):

| Command | Scope | Gate | Behaviour |
|---|---|---|---|
| `/new` | app | always | Start a new chat (existing `handleNewChat`). |
| `/clear` | app | always | Start a fresh thread. v1: same action as `/new`; kept because it is the muscle-memory name. |
| `/settings` | app | always | Open settings (existing `handleOpenSettings`). |
| `/cron` | agent | `hasJobs` | Insert `/cron ` into the composer for the user to complete and send to the agent. |

### Non-goals (v1)

- Sourcing commands live from `GET /v1/skills` / `/v1/toolsets` (Hermes-only,
  needs connector allow-list work, shows technical names). Deferred.
- Arguments/parameter hints beyond free-text after the command.
- Keyboard arrow-key navigation is a nice-to-have, not required (see below).
- The connector claim-expiry reconnect bug — real, but unrelated to this
  feature; tracked separately.

## Architecture

Three additions, all under `src/ui/chat/`, wired into the existing
`AgentScreen` (`src/app/(app)/index.tsx`).

### 1. Command registry — `src/ui/chat/slashCommands.ts`

Pure data + pure functions (no React), so it is trivially unit-testable.

```ts
type SlashCommand = {
  name: string;            // 'new' — the token after the slash
  description: string;     // one line shown in the menu
  scope: 'app' | 'agent';
  gate?: keyof AgentCapabilities; // e.g. 'hasJobs'; undefined = always
  action?: AppCommandId;   // app scope: which handler to run
  send?: string;           // agent scope: literal text to insert (e.g. '/cron ')
};

// The static table (the four commands above).
export const SLASH_COMMANDS: SlashCommand[];

// Menu trigger: input is a slash-command query iff it matches ^/(\w*)$
// (a slash at position 0, word chars only, no space yet).
export function slashQuery(input: string): string | null;

// Filter: prefix match on name, case-insensitive, respecting capability gates.
export function matchCommands(
  input: string,
  capabilities: AgentCapabilities | null,
): SlashCommand[];
```

`matchCommands` returns `[]` when the input is not a slash query or nothing
matches — the caller hides the menu and lets the text pass through untouched.

### 2. Menu component — `src/ui/chat/SlashCommandMenu.tsx`

A presentational overlay pinned directly above the input bar (same visual
family as the composer: `colors.surface`, `colors.line`, `radius`, `space`,
`typography` tokens — no raw values). Props:

```ts
{
  commands: SlashCommand[];      // already filtered
  onSelect: (cmd: SlashCommand) => void;
}
```

Renders one tappable row per command: monospaced `/name` + muted description.
Rendered only when `commands.length > 0`. No internal state; selection is a tap.

### 3. Wiring in `AgentScreen`

The composer already funnels every keystroke through `measureComposer(text)`,
which owns `input` state. Derive the menu from `input`:

```ts
const slashMatches = useMemo(
  () => matchCommands(input, capabilities),
  [input, capabilities],
);
```

Render `<SlashCommandMenu commands={slashMatches} onSelect={handleSlashSelect}/>`
between the `FlashList` and the input bar, inside the `KeyboardAvoidingView`, so
it sits above the composer and below the thread.

`handleSlashSelect`:

- **app scope** → clear the input, then run the mapped handler
  (`/new`, `/clear` → `handleNewChat`; `/settings` → `handleOpenSettings`).
  App commands take no arguments, so they execute immediately.
- **agent scope** → set the input to `cmd.send` (e.g. `'/cron '`, trailing
  space), keep focus on the composer. The user completes any arguments and
  presses send; it flows through the **unchanged** `handleSend` path as literal
  text. Selecting does *not* auto-send — cron and future agent commands may take
  arguments.

No change to `handleSend`, the adapters, the reducer, or persistence: an agent
command is an ordinary user message whose text happens to start with `/`.

## Interaction details

- **Trigger:** menu appears only when the composer content matches `^/(\w*)$` —
  a slash at the very start, no space yet. Mirrors Telegram and Claude Code;
  a slash mid-message is just text.
- **Filter:** as the user types more (`/`, `/c`, `/cr`), the list narrows by
  case-insensitive prefix on the command name.
- **Dismiss:** typing a space (moving into arguments), clearing the slash, no
  matches, or selecting a command all hide the menu (they make
  `matchCommands` return `[]` or clear the input).
- **Select:** tap a row → `handleSlashSelect`.
- **Keyboard nav (optional, deferred):** on web/hardware keyboards, up/down to
  move a highlight and Enter to pick would be a nice enhancement. Out of scope
  for v1; tap is the primary and sufficient interaction on mobile.

## Capability gating

`capabilities` is already computed in `AgentScreen`
(`activeAgent.capabilities ?? defaultCapabilitiesFor(framework)`). A command
with a `gate` is included only when that capability flag is true. With no active
agent or a generic agent, `hasJobs` is false, so `/cron` is hidden and the menu
shows only the three app commands.

## Testing

Core verification is the pure registry, in `__tests__/chat/slashCommands.test.ts`
(alongside the existing `streamReducer` / `blocksToText` tests):

- `slashQuery`: `'/'`, `'/ne'` → query; `'hello'`, `'/cron list'` (has space),
  `'a /new'` (not at start) → null.
- `matchCommands` prefix: `'/ne'` → `[/new]`; `'/'` → all visible; `'/zzz'` → `[]`.
- Capability gate: with `hasJobs: false` (or `null` capabilities), `'/cron'`
  → `[]`; with `hasJobs: true`, `'/cron'` → `[/cron]`.
- Case-insensitivity: `'/NEW'` → `[/new]`.

Green bar: `npx tsc --noEmit` + `npm test` both pass. A light render test of
`SlashCommandMenu` (rows present, `onSelect` fires) is optional given the
component is presentational.

## Open points

- **`/cron` wire text.** The exact string Hermes expects (`/cron` vs
  `/cronjob list`) should be confirmed against Hermes before shipping. Because
  agent commands *insert into the composer* rather than auto-send, a wrong guess
  is user-correctable, but the suggested default should match Hermes.
- **`/cron` vs the Cron screen.** A native `hasJobs`-gated Cron screen already
  exists (opened from the sidebar). `/cron` is deliberately the quick
  "just ask the agent" path and coexists with it; it is the one v1 command that
  exercises the literal-passthrough mechanism. If the text path proves redundant
  with the native screen, `/cron` can later become an app command that navigates
  to that screen instead — a one-line change of scope in the registry.
- **`/clear` vs `/new`.** Identical in v1. If a distinct behaviour is wanted
  later (e.g. `/clear` deletes the current thread rather than archiving it to
  history), it becomes a separate `action` — no structural change.
