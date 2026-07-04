# Slash Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side `/` command menu to the chat composer — app actions handled locally, agent commands sent to the agent as literal text — with capability gating per framework.

**Architecture:** A pure command registry (data + matcher functions) drives a presentational menu component, wired into the existing `AgentScreen` off its `input` state. App commands run existing handlers; agent commands insert literal text into the composer and flow through the unchanged send path. No relay, connector, or agent change.

**Tech Stack:** React Native (Expo SDK 56, React 19), TypeScript (strict), Jest (`jest-expo`), `@testing-library/react-native`. Design tokens from `src/theme.ts`.

## Global Constraints

- **Design tokens only** — no raw hex or magic numbers in components. Import `colors`, `space`, `radius`, `typography` from `@/theme`. Type-scale export is named `typography` (not `type`).
- **Path aliases:** `@/*` → `src/*`.
- **React Compiler is on** — do not hand-add memoization it provides; follow the rules of hooks strictly.
- **Green bar** = `npx tsc --noEmit` and `npm test` both pass. A slice is complete only when both are green.
- **Capabilities shape** (`src/agents/types.ts`): boolean flags `hasRunApproval`, `hasRunStop`, `hasStreaming`, `hasJobs`, `hasSessions`.

---

### Task 1: Command registry (`slashCommands.ts`)

Pure data + pure functions — no React. This is the whole behavioural core; the rest is presentation and wiring.

**Files:**
- Create: `src/ui/chat/slashCommands.ts`
- Test: `__tests__/chat/slashCommands.test.ts`

**Interfaces:**
- Consumes: `AgentCapabilities` from `@/agents/types`.
- Produces:
  - `type AppCommandId = 'new' | 'clear' | 'settings'`
  - `type CapabilityFlag = 'hasRunApproval' | 'hasRunStop' | 'hasStreaming' | 'hasJobs' | 'hasSessions'`
  - `type SlashCommand = { name: string; description: string; scope: 'app'; action: AppCommandId; gate?: CapabilityFlag } | { name: string; description: string; scope: 'agent'; send: string; gate?: CapabilityFlag }`
  - `const SLASH_COMMANDS: readonly SlashCommand[]`
  - `function slashQuery(input: string): string | null`
  - `function matchCommands(input: string, capabilities: AgentCapabilities | null): SlashCommand[]`

- [ ] **Step 1: Write the failing test**

Create `__tests__/chat/slashCommands.test.ts`:

```ts
import { SLASH_COMMANDS, slashQuery, matchCommands } from '@/ui/chat/slashCommands';
import { defaultCapabilitiesFor } from '@/agents/frameworks';

const hermesCaps = defaultCapabilitiesFor('hermes');   // hasJobs: true
const genericCaps = defaultCapabilitiesFor('openai');  // hasJobs: false

const names = (cmds: ReturnType<typeof matchCommands>) => cmds.map((c) => c.name);

describe('slashQuery', () => {
  it('returns the token after a leading slash', () => {
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/ne')).toBe('ne');
  });

  it('returns null when it is not a command query', () => {
    expect(slashQuery('hello')).toBeNull();
    expect(slashQuery('')).toBeNull();
    expect(slashQuery('/cron list')).toBeNull(); // space ends the token
    expect(slashQuery(' /new')).toBeNull();       // slash not at start
  });
});

describe('matchCommands', () => {
  it('prefix-matches by command name', () => {
    expect(names(matchCommands('/ne', genericCaps))).toEqual(['new']);
  });

  it('is case-insensitive', () => {
    expect(names(matchCommands('/NEW', genericCaps))).toEqual(['new']);
  });

  it('shows only app commands for a generic agent', () => {
    expect(names(matchCommands('/', genericCaps))).toEqual(['new', 'clear', 'settings']);
  });

  it('adds the gated /cron command when hasJobs is true', () => {
    expect(names(matchCommands('/', hermesCaps))).toEqual(['new', 'clear', 'settings', 'cron']);
  });

  it('hides a gated command when the flag is false or capabilities are null', () => {
    expect(matchCommands('/cron', genericCaps)).toEqual([]);
    expect(matchCommands('/cron', null)).toEqual([]);
  });

  it('returns the gated command when its flag is true', () => {
    expect(names(matchCommands('/cron', hermesCaps))).toEqual(['cron']);
  });

  it('returns empty for a non-query or no match', () => {
    expect(matchCommands('hello', hermesCaps)).toEqual([]);
    expect(matchCommands('/zzz', hermesCaps)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/chat/slashCommands.test.ts`
Expected: FAIL — cannot resolve `@/ui/chat/slashCommands`.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/chat/slashCommands.ts`:

```ts
/**
 * The slash-command registry: a static table plus two pure functions that the
 * composer uses to decide when to show the `/` menu and what to put in it.
 *
 * A command is either 'app' (handled in the client — never sent) or 'agent'
 * (literal text inserted into the composer and sent to the agent, which parses
 * the `/` itself). Gated commands appear only when the active agent's
 * capabilities allow — the same capability-driven UI the rest of the app uses.
 */

import type { AgentCapabilities } from '@/agents/types';

export type AppCommandId = 'new' | 'clear' | 'settings';

/** The boolean capability flags a command may gate on. */
export type CapabilityFlag =
  | 'hasRunApproval'
  | 'hasRunStop'
  | 'hasStreaming'
  | 'hasJobs'
  | 'hasSessions';

export type SlashCommand =
  | { name: string; description: string; scope: 'app'; action: AppCommandId; gate?: CapabilityFlag }
  | { name: string; description: string; scope: 'agent'; send: string; gate?: CapabilityFlag };

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: 'new', description: 'Start a new chat', scope: 'app', action: 'new' },
  { name: 'clear', description: 'Clear this thread', scope: 'app', action: 'clear' },
  { name: 'settings', description: 'Open settings', scope: 'app', action: 'settings' },
  { name: 'cron', description: 'Ask the agent about scheduled jobs', scope: 'agent', send: '/cron ', gate: 'hasJobs' },
];

/**
 * The command token when `input` is a slash query (a slash at position 0
 * followed by word chars, no space yet), else null. `'/'` → `''`, `'/ne'` →
 * `'ne'`, `'/cron list'` → null.
 */
export function slashQuery(input: string): string | null {
  const match = /^\/(\w*)$/.exec(input);
  return match ? match[1] : null;
}

/** Commands matching the current input, respecting capability gates. */
export function matchCommands(
  input: string,
  capabilities: AgentCapabilities | null,
): SlashCommand[] {
  const query = slashQuery(input);
  if (query === null) return [];
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => {
    if (cmd.gate && !capabilities?.[cmd.gate]) return false;
    return cmd.name.toLowerCase().startsWith(q);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/chat/slashCommands.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/ui/chat/slashCommands.ts __tests__/chat/slashCommands.test.ts
git commit -m "feat(chat): slash-command registry + matcher"
```

---

### Task 2: Menu component (`SlashCommandMenu.tsx`)

A presentational overlay listing the filtered commands. No state; selection is a tap.

**Files:**
- Create: `src/ui/chat/SlashCommandMenu.tsx`
- Test: `__tests__/chat/slashCommandMenu.test.tsx`

**Interfaces:**
- Consumes: `SlashCommand` from `./slashCommands`.
- Produces: `function SlashCommandMenu(props: { commands: SlashCommand[]; onSelect: (cmd: SlashCommand) => void }): JSX.Element | null` — renders `null` when `commands` is empty.

- [ ] **Step 1: Write the failing test**

Create `__tests__/chat/slashCommandMenu.test.tsx`:

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { SlashCommandMenu } from '@/ui/chat/SlashCommandMenu';
import { SLASH_COMMANDS } from '@/ui/chat/slashCommands';

const appCommands = SLASH_COMMANDS.filter((c) => c.scope === 'app');

it('renders a row per command and fires onSelect on press', () => {
  const onSelect = jest.fn();
  render(<SlashCommandMenu commands={appCommands} onSelect={onSelect} />);

  expect(screen.getByText('/new')).toBeTruthy();
  expect(screen.getByText('/settings')).toBeTruthy();

  fireEvent.press(screen.getByText('/new'));
  expect(onSelect).toHaveBeenCalledWith(appCommands[0]);
});

it('renders nothing when there are no commands', () => {
  const { toJSON } = render(<SlashCommandMenu commands={[]} onSelect={jest.fn()} />);
  expect(toJSON()).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/chat/slashCommandMenu.test.tsx`
Expected: FAIL — cannot resolve `@/ui/chat/SlashCommandMenu`.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/chat/SlashCommandMenu.tsx`:

```tsx
/**
 * The `/` command menu — a small overlay pinned above the composer that lists
 * the commands matching what the user has typed. Presentational only: the
 * parent filters (`matchCommands`) and handles selection.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { colors, radius, space, typography } from '../../theme';
import type { SlashCommand } from './slashCommands';

export function SlashCommandMenu({
  commands,
  onSelect,
}: {
  commands: SlashCommand[];
  onSelect: (cmd: SlashCommand) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <View style={styles.menu}>
      {commands.map((cmd, i) => (
        <Pressable
          key={cmd.name}
          onPress={() => onSelect(cmd)}
          style={[styles.row, i > 0 && styles.rowDivider]}
          accessibilityRole="button"
          accessibilityLabel={`/${cmd.name} — ${cmd.description}`}
        >
          <Text style={styles.name}>/{cmd.name}</Text>
          <Text style={styles.desc} numberOfLines={1}>
            {cmd.description}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm + 2,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  name: {
    ...typography.mono,
    color: colors.ink,
  },
  desc: {
    ...typography.small,
    color: colors.muted,
    flexShrink: 1,
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/chat/slashCommandMenu.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/ui/chat/SlashCommandMenu.tsx __tests__/chat/slashCommandMenu.test.tsx
git commit -m "feat(chat): slash-command menu component"
```

---

### Task 3: Wire the menu into `AgentScreen`

Derive the filtered commands from the composer `input`, render the menu above the input bar, and handle selection. No new behaviour in the send path — an agent command is an ordinary user message.

**Files:**
- Modify: `src/app/(app)/index.tsx`

**Interfaces:**
- Consumes: `matchCommands`, `SlashCommand` from `@/ui/chat/slashCommands`; `SlashCommandMenu` from `@/ui/chat/SlashCommandMenu`. Existing handlers `handleNewChat`, `handleOpenSettings`; existing state `input`, setter via `measureComposer`/`setInput`; existing `inputRef`; existing `capabilities`.
- Produces: (screen-internal) `handleSlashSelect(cmd: SlashCommand)`.

- [ ] **Step 1: Add imports**

In `src/app/(app)/index.tsx`, alongside the other `@/ui/chat/*` imports (near the `MdReader` import, ~line 35), add:

```ts
import { SlashCommandMenu } from '@/ui/chat/SlashCommandMenu';
import { matchCommands, type SlashCommand } from '@/ui/chat/slashCommands';
```

Add `useMemo` to the existing React import (line 9):

```ts
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
```

- [ ] **Step 2: Derive the filtered commands**

`capabilities` is already computed in the component (currently `const capabilities = activeAgent ? … : null;` ~line 294). Immediately after that line, add:

```ts
const slashMatches = useMemo(() => matchCommands(input, capabilities), [input, capabilities]);
```

- [ ] **Step 3: Add the selection handler**

Place `handleSlashSelect` next to the other `handle*` callbacks (e.g. just after `handleOpenSettings`, ~line 389). It clears the input and runs the app handler for app commands; for agent commands it inserts the literal text and keeps focus so the user can add arguments and send.

```ts
const handleSlashSelect = useCallback(
  (cmd: SlashCommand) => {
    Haptics.selectionAsync().catch(() => {});
    if (cmd.scope === 'app') {
      setInput('');
      setComposerHeight(COMPOSER_MIN_HEIGHT);
      if (cmd.action === 'settings') handleOpenSettings();
      else handleNewChat(); // 'new' and 'clear' both start a fresh thread in v1
      return;
    }
    setInput(cmd.send);
    inputRef.current?.focus();
  },
  [handleOpenSettings, handleNewChat],
);
```

- [ ] **Step 4: Render the menu above the input bar**

The input bar is the `<View style={[styles.inputBar, …]}>` block (~line 594), a sibling of `FlashList` inside `KeyboardAvoidingView`. Immediately **before** that `<View style={[styles.inputBar …`, insert:

```tsx
<SlashCommandMenu commands={slashMatches} onSelect={handleSlashSelect} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If TS reports `handleNewChat`/`handleOpenSettings` used before declaration, move `handleSlashSelect` below both — they are `useCallback`s defined earlier in the component, so ordering after them is correct.)

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS — no regressions; the Task 1 & 2 suites cover the command logic and menu.

- [ ] **Step 7: Manual smoke check**

Run: `npm run ios` (or `npm start`). In a chat:
- Type `/` → menu shows `/new`, `/clear`, `/settings` (and `/cron` when the agent is Hermes).
- Type `/se` → narrows to `/settings`; tap it → settings opens, composer clears.
- Type `/cron` → tap → composer becomes `/cron ` with focus; press send → arrives as a normal message.
- Type a normal message starting without `/` → no menu; sending is unchanged.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/index.tsx"
git commit -m "feat(chat): wire slash-command menu into the composer"
```

---

## Self-Review

**Spec coverage:**
- Registry / matcher (no `/v1/skills`) → Task 1. ✅
- App vs agent scope, literal passthrough → Task 1 (`SlashCommand` union) + Task 3 (`handleSlashSelect`). ✅
- Capability gating (`hasJobs` hides `/cron`; generic agent shows app-only) → Task 1 `matchCommands` + tests. ✅
- Trigger `^/(\w*)$`, filter, dismiss on space/no-match/select → Task 1 `slashQuery` + Task 3 derived state. ✅
- Presentational menu, tokens only, renders null when empty → Task 2. ✅
- Wiring off existing `input`, unchanged `handleSend` → Task 3. ✅
- Command set (`/new`, `/clear`, `/settings`, `/cron`) → Task 1 `SLASH_COMMANDS`. ✅
- Non-goals (skills, arg hints, keyboard nav) → not implemented, correct.

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `SlashCommand` union, `AppCommandId`, `CapabilityFlag`, `slashQuery`, `matchCommands`, `SLASH_COMMANDS`, `SlashCommandMenu({ commands, onSelect })`, `handleSlashSelect` are named identically across tasks. `cmd.scope` discriminates `action` (app) vs `send` (agent) consistently.

**Open point carried from spec:** the `/cron` `send` text (`'/cron '`) should be confirmed against Hermes's real command syntax before shipping; because it inserts into the composer rather than auto-sending, a wrong guess is user-correctable.
