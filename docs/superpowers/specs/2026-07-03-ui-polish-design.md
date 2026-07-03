# UI Polish & Flow Pass — Design

**Date:** 2026-07-03
**Status:** Approved (Dane approved scope: no new pages; include stop-while-streaming,
copy-any-message, rename/delete chats)
**Goal:** Make Summit feel like the smoothest, cleanest possible client — fix the things that
make the current UI feel rough (streaming scroll fights, markdown type ramp, header
inconsistency, token violations) without adding surface area. No new pages.

## Context

Audit of every screen (`src/app/**`) and UI component (`src/ui/**`) against `DESIGN_SYSTEM.md`,
`BRANDING.md`, and `PRD.md` found the bones strong (token system, hybrid message layout, cron
detail) but eight concrete gaps between "good" and "fluent". The product sells the flow; each
slice below removes a specific friction.

## Slices

### A. Chat streaming smoothness (`src/app/(app)/index.tsx`)

**Problem:** A `useEffect` calls `scrollToEnd` on every `messages` change (i.e. every stream
tick), fighting FlashList's `maintainVisibleContentPosition`. The user cannot scroll up while a
reply streams — the list yanks back down. Separately, every SSE chunk triggers a full
`setMessages` → full markdown re-parse, which janks on long replies.

**Design:**
- Delete the `scrollToEnd`-on-messages effect. FlashList's
  `maintainVisibleContentPosition.autoscrollToBottomThreshold` already follows the bottom when
  the user is near it and releases when they scroll up.
- Keep one explicit `scrollToEnd` when the user sends a message (they expect to land at the
  bottom of their own send).
- Throttle stream flushes: inside the `for await` loop, only call `setMessages` when
  `turn.done` **or** ≥ 60 ms since the last flush. Always flush the final state. Extract the
  gate as a small pure helper (e.g. `shouldFlush(lastFlushAt, now, done)`) so it is unit-testable.

### B. Stop button while streaming (`index.tsx`)

**Problem:** During a reply the composer locks and the send button dims; there is no way to
stop a long reply. Operator control is the brand.

**Design:**
- While `streaming`, the send circle becomes an enabled stop button (square glyph, same 44px
  ink circle, accessibility label "Stop reply").
- Tapping sets a `stopRequestedRef`; the stream loop checks it each iteration and `break`s.
  Breaking the `for await` invokes the async generator's cleanup (adapter `finally`).
- The partial reply is settled (`settleBlocks`) and persisted exactly like a completed one.
  Status returns to `idle`. No error styling — a stopped reply is a normal reply.

### C. Markdown type ramp (`src/ui/chat/richMarkdown.tsx`)

**Problem:** Markdown body is 16px while user bubbles / plain agent text are 17px
(`typography.body`); `##` renders as a 13px uppercase label — smaller than body text — although
`##` is the most common heading in agent output and `DESIGN_SYSTEM.md` specifies markdown
headings at 20/600. Every bullet dot is accent blue, violating "one accent, sparingly".

**Design:**
- `body`/`paragraph`: 17/24 (match `typography.body`).
- Heading ramp: `heading1` 24/30 · 700; `heading2` 20/26 · 600 (the `typography.h` token,
  normal case, no letterspacing/uppercase); `heading3` 17/24 · 600. Blockquote/table/code
  styles unchanged.
- Bullet dots: `colors.faint` (quiet grey), not accent. Ordered-list markers stay muted.

### D. Copy any message (`index.tsx`, `src/ui/chat/*`)

**Design:**
- Long-press on a user bubble or an agent message copies its plain text via `expo-clipboard`,
  with a selection haptic and a transient "Copied" caption (≈1.2 s fade, muted pill, bottom
  center — one shared lightweight component).
- New pure helper `blocksToText(blocks: AgentBlock[]): string` — markdown blocks contribute
  their source; text blocks their span text; code blocks fenced text; file blocks the file
  name; chips/tables a sensible plain rendering. Unit-tested.

### E. Rename / delete chats (`src/ui/chat/Sidebar.tsx`, `index.tsx`)

**Design:**
- Long-press a chat row → action sheet (iOS `ActionSheetIOS`, `Alert` buttons elsewhere) with
  **Rename**, **Delete**, **Cancel**.
- Rename opens a minimal dark modal (one input pre-filled with the title, Save/Cancel) →
  `repo.upsertSession({ ...session, title })` and summary refresh.
- Delete confirms ("Delete chat? This removes it from this device.") →
  `repo.deleteSession(id)`. If the deleted session is the open one, reset to a fresh thread
  (same as New chat).

### F. Unified screen header (`src/ui/ScreenHeader.tsx`, consumers)

**Problem:** Three header patterns: chat (custom, stays), cron list (back + 24px hardcoded
title + subtitle), settings/pair (back + 17px title). Feels like three apps.

**Design:**
- New `ScreenHeader` component: back button (38px, radius 10) · title 17/600
  (`letterSpacing -0.2`) · optional subtitle line (caption, muted) · optional right accessory
  (e.g. cron detail's pause/run controls).
- Adopt in: cron list (title "Cron Drops", subtitle = summary line with its dot), cron detail
  (accessories = pause + Run), `SettingsScreen` shell (all settings pages inherit), pair.
- Chat's `Header` is intentionally specialized and unchanged.

### G. Token & brand hygiene (theme + small fixes)

- `src/theme.ts`: add `success: '#7BD88F'` (same green family as `mdString`; used for "Copied"
  states) and `scrim: '#000000'`.
- `pair.tsx`: replace three raw `#4ADE80` with `colors.success`.
- `sign-in.tsx`: raw `#FF6B6B` → `colors.error`.
- `Sidebar.tsx`: scrim `'#000000'` → `colors.scrim`.
- `connect.tsx`: brand mark `Bot` icon → `Mountain` (BRANDING.md forbids generic robot marks).
- Cron list summary dot: accent **only when a job is running**; otherwise `muted`.
- Settings display-name input: flexible width (flex-basis with a sensible max) instead of the
  cramped fixed 116–150px.
- Radii normalization (visible same-class drift only): icon/back buttons and small pill
  buttons → 10; row/pressed shapes → 10; card containers stay 14/16 as today. No sweeping
  spacing rewrite — only the cases called out here.

### H. Pair screen flow (`pair.tsx`)

- The intro promises "two steps"; the screen shows three. Restructure: **Step 1 — Install the
  connector** (agent-prompt card, with the curl one-liner beneath it as a quiet "or run it
  yourself in a terminal" secondary card, no separate step number); **Step 2 — Name and pair**.
- Remove `autoFocus` (keyboard slams over the instructions).
- Wrap content in `KeyboardAvoidingView` so the code field and Pair button stay visible while
  typing.

## Out of scope

- New pages of any kind (approved: none).
- Light mode, syntax-highlight changes, animation systems beyond what exists.
- Cron job creation/editing (would be its own spec).
- Sweeping spacing/radius renormalization beyond the named cases.
- Chat empty-state content (per the no-onboarding-scaffolding rule the void stays quiet).

## Testing & success criteria

- `npx tsc --noEmit` and `npm test` green (the project's green bar).
- New unit tests: stream-flush gate helper; `blocksToText`; rename/delete session handlers
  (repo interactions); markdown heading/bullet styles where cheaply assertable via the
  existing RNTL harness.
- Behavior checks encoded in tests where feasible (stop settles + persists partial reply).
- Every changed line traces to a slice above.
