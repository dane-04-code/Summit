# Reply-to-message (Telegram-style quote reply)

## Problem
Once a conversation has moved on, there's no way to point a new message at *which* earlier message
(yours or the agent's) it's answering — every reply lands as a bare new line at the bottom of the
thread. Telegram's reply affordance solves that, and critically, the referenced content needs to
survive into what the agent actually sees: if you come back the next day and reply "how did you get
on with this?" to an old agent message, the agent needs that original content folded into the new
turn's text, not just a cosmetic UI link — Hermes context can roll over or reset between sessions.

## Proposal
Long-press a message → a small custom action pill appears with **Reply** and **Copy** (long-press
today triggers Copy directly; this changes it to a two-option menu, Copy behaving exactly as before).
Tapping Reply freezes the target message and shows a quoted strip attached to the composer. Sending:

- Persists the raw typed text as the user message (`replyTo` stamps which message it's answering —
  id, author, a short frozen preview for the UI).
- Sends the **agent** a different string: the full flattened original message, quoted, followed by
  what was typed —
  ```
  > [full original message, flattened, capped ~4000 chars]

  <what you typed>
  ```
  so the referenced content is literally present in the new turn regardless of the agent's own
  session memory.

Two derived strings, not one:
1. **UI preview** — short (~100 char) frozen snippet, cosmetic, shown in the composer's quoted strip
   and above the sent message in the thread.
2. **Outbound quote body** — the full flattened target message (capped ~4000 chars / a couple
   thousand tokens, so replying to a huge agent dump doesn't dominate the next turn's context),
   folded into the string actually handed to `adapter.sendMessage(...)`.

Reply targets are a **frozen snippet, not a live pointer** — no scroll-to-original, no re-render if
the original changes. Simplest version that's real; upgradable later since the target `id` is still
stored. Only one level of quoting ever renders (matches Telegram: replying to a reply shows just the
immediate parent, never the whole chain). `action` (approval) messages are not reply-able.

## Assumptions
- Frozen-snippet (vs. live-linked) reply is acceptable for v1 — smallest real slice; the `id` staying
  on `replyTo` means live-linking (scroll-to-original) is a clean follow-up, not a rewrite.
- ~4000 chars is a reasonable cap for the outbound quote body — Dane confirmed this default rather
  than uncapped or a different ceiling.
- Long-press moving from "instant copy" to "menu with Reply + Copy" is fine — Copy still works, just
  one tap further in.

## Tradeoffs considered
- **System `ActionSheetIOS`/`Alert` for the long-press menu** — rejected. Every other affordance in
  this app (composer tray, approval cards, toasts) is bespoke and dark-only; a system sheet is
  light/adaptive on iOS and would break the design lock in `DESIGN_SYSTEM.md`.
- **Reply as UI-only affordance, no effect on outbound text** — rejected per Dane: the point is
  carrying old content forward into the agent's next turn, not just organizing the thread visually.
- **Live-linked reply (look up target by id at render/send time, scroll-to-highlight on tap)** —
  deferred, not rejected; noted as the natural v2 since the id is preserved.

## Affected areas
- `src/ui/chat/types.ts` — add optional `replyTo?: { id: string; author: 'user' | 'agent'; preview:
  string }` to the `user` and `agent` variants of `Message`. Add two helpers: a short-preview
  truncator (~100 chars, UI strip) and `buildQuotedContext(target: Message, maxChars = 4000): string`
  (full flatten + cap, outbound fold-in) — both built on the existing `messageToText`/`blocksToText`.
- `src/app/(app)/index.tsx`:
  - `MessageRow` — long-press opens the action pill instead of calling `onCopy` directly; renders the
    quoted strip above a message's content when `replyTo` is set.
  - `AgentScreen` — new `replyTarget: Message | null` state holding the **full** target message (not
    just its preview), cleared on send or on the strip's dismiss (×).
  - `submitText` — builds `text` (raw typed input, used for the stored/displayed user message and
    `replyTo` preview) and `outboundText` (blockquote-prefixed via `buildQuotedContext`, used only for
    `adapter.sendMessage(outboundText, ...)`) when `replyTarget` is set; otherwise unchanged.
- `src/ui/chat/ChatComposer.tsx` (or a sibling row in `index.tsx` — builder's call on the exact
  component boundary) — renders the active quoted-reply strip attached to the tray with a dismiss (×).
- New component, e.g. `src/ui/chat/MessageActionMenu.tsx` — the long-press pill (Reply / Copy) and the
  quoted-strip renderer, styled from `theme.ts` tokens only (no raw hex/magic numbers; whitespace over
  borders/boxes per `DESIGN_SYSTEM.md`).
- **No DB migration** — `StoredMessage.message` (`src/db/sqlite.ts`) is a JSON blob; old rows without
  `replyTo` just deserialize with the field absent.
- **Not touched:** connector/relay/protocol, the adapter *interface* (`sendMessage(text, opts)` still
  just takes a string — Hermes/OpenClaw/generic-OpenAI adapters need zero changes, only the string
  the call site hands them changes).

## Source of truth referenced
- `docs/TECHNICAL_REFERENCE.md` — design tokens live in `src/theme.ts`; message layout is hybrid (user
  bubble / agent full-width); long lists use FlashList.
- `DESIGN_SYSTEM.md` — dark-only, one restrained accent, whitespace over boxes — rules out a
  boxed/bordered quote card in favor of a thin muted strip.
- `FRAMEWORKS.md` — Hermes is a plain OpenAI-compatible Chat Completions surface with no reply/thread
  field, confirming the fold-into-outbound-text approach (vs. a protocol-level reply reference) is the
  only way for the agent to actually see quoted content.
- Read directly (code, not docs): `src/ui/chat/types.ts`, `src/app/(app)/index.tsx`,
  `src/db/sqlite.ts` — confirmed the message model, existing long-press-copy pattern, and JSON-blob
  persistence (no migration needed).

## Handoff to builders
Done means:
- Long-press on any user/agent message shows Reply + Copy; Copy behaves exactly as before.
- Tapping Reply shows a dismissible quoted strip (author + truncated snippet) attached to the
  composer; typing and sending attaches `replyTo` to the new message and clears the strip; × dismiss
  clears it without sending.
- The quoted strip renders above the message in the thread and persists across an app reload (kill
  and reopen — confirms the sqlite round trip) for both a user-authored and an agent-authored target.
- When replying, the agent actually receives the full quoted original (capped ~4000 chars) followed by
  the typed text — verify by inspecting the string passed to `adapter.sendMessage`, not just the
  rendered thread (the displayed user bubble intentionally does *not* show the blockquote — only the
  separate quoted strip does).
- `npx tsc --noEmit` and `npm test` both green — add coverage for `replyTo`, the short-preview
  truncator, and `buildQuotedContext` (including the cap boundary).

## Handoff to tester
- Run the standard messaging send/receive loop from `docs/TESTING.md` (mock-agent loop,
  `scripts/mock-agent.mjs`) with a reply attached on both a user-turn and an agent-turn target.
- Idea-specific checks not already covered there:
  - Reply strip survives app relaunch.
  - Dismissing a reply-in-progress doesn't leak into the next send.
  - Long-press menu doesn't regress existing Copy.
  - Only one level of quoting ever renders (replying to a message that itself has `replyTo` shows just
    the immediate parent).
  - The mock agent actually observes the folded-in quoted text in the request it receives when a reply
    is sent — this is the behavior the whole feature is for, so it needs an explicit check, not just a
    UI-level pass.
  - A reply to a very long agent message (code block / long doc) truncates at the cap rather than
    ballooning the outbound request.
