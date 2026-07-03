# UI Polish & Flow Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the eight slices of `docs/superpowers/specs/2026-07-03-ui-polish-design.md` — streaming smoothness, stop button, markdown type ramp, copy-any-message, rename/delete chats, unified screen header, token/brand hygiene, pair-screen flow.

**Architecture:** Pure helpers (`shouldFlush`, `blocksToText`, `renameSession`) are extracted into existing logic modules and TDD'd; screen work is mechanical edits on `src/app/(app)/*` and `src/ui/*` using theme tokens only. One new shared component (`ScreenHeader`), one new micro-component (`CopiedToast`).

**Tech Stack:** Expo SDK 56 / RN 0.85 / React 19, expo-router, @shopify/flash-list, lucide-react-native, expo-clipboard, expo-haptics, jest-expo + @testing-library/react-native.

## Global Constraints

- Never use raw hex or magic numbers in components — import tokens from `src/theme.ts` (CLAUDE.md).
- React Compiler is on: no hand memoization; follow rules of hooks strictly.
- Green bar = `npx tsc --noEmit` AND `npm test` both passing — run both before every commit.
- Copy rules per BRANDING.md: "What happened. What to try." for errors; no robot iconography.
- Surgical changes: touch only lines traceable to the spec.

---

### Task 1: Theme tokens + hex/brand hygiene (spec slice G, part 1)

**Files:**
- Modify: `src/theme.ts` (colors + radius)
- Modify: `src/app/(app)/pair.tsx` (3× `#4ADE80`)
- Modify: `src/app/(auth)/sign-in.tsx` (1× `#FF6B6B`)
- Modify: `src/ui/chat/Sidebar.tsx` (scrim `#000000`)
- Modify: `src/app/(app)/connect.tsx` (Bot → Mountain)

**Interfaces:**
- Produces: `colors.success` (`#7BD88F`), `colors.scrim` (`#000000`), `radius.control` (`10`) — later tasks use `radius.control`.

- [ ] **Step 1: Add tokens to `src/theme.ts`**

In `colors`, after `error: '#FF6B6B',`:

```ts
  success: '#7BD88F', // confirmation moments ("Copied", paired) — same green family as mdString
  scrim: '#000000', // overlay scrim behind the drawer (applied at partial opacity)
```

In `radius`, after `input: 14,`:

```ts
  control: 10, // small controls: icon/back buttons, small pills, list rows
```

- [ ] **Step 2: Replace raw hex**

`pair.tsx`: replace all three `"#4ADE80"` / `'#4ADE80'` with `colors.success` (two `<Check color=…>` props, one `copiedLabel` style color).
`sign-in.tsx` line ~119: `color: '#FF6B6B'` → `color: colors.error`.
`Sidebar.tsx` scrim style: `backgroundColor: '#000000'` → `backgroundColor: colors.scrim`.

- [ ] **Step 3: Swap the robot mark**

`connect.tsx`: `import { Bot } from 'lucide-react-native'` → `import { Mountain } from 'lucide-react-native'`; `<Bot size={30} …>` → `<Mountain size={30} color={colors.bg} strokeWidth={1.7} />`.

- [ ] **Step 4: Verify green + no stray hex**

Run: `npx tsc --noEmit` → clean. `npm test` → 111 passing.
Run: `grep -rnE "#[0-9A-Fa-f]{6}" src --include="*.tsx" | grep -v theme.ts` → only comments/none.

- [ ] **Step 5: Commit** — `feat(ui): success/scrim/control tokens; kill raw hex and the robot mark`

---

### Task 2: Streaming smoothness — flush gate + scroll behavior (slice A)

**Files:**
- Modify: `src/ui/chat/streamReducer.ts`
- Test: `__tests__/chat/streamFlush.test.ts` (new)
- Modify: `src/app/(app)/index.tsx`

**Interfaces:**
- Produces: `shouldFlush(lastFlushAt: number, now: number, done: boolean): boolean` and `STREAM_FLUSH_MS = 60`, exported from `streamReducer.ts` (Task 3 reuses the loop shape).

- [ ] **Step 1: Failing test**

```ts
// __tests__/chat/streamFlush.test.ts
import { shouldFlush, STREAM_FLUSH_MS } from '@/ui/chat/streamReducer';

describe('shouldFlush', () => {
  it('always flushes terminal events regardless of elapsed time', () => {
    expect(shouldFlush(1000, 1001, true)).toBe(true);
  });
  it('suppresses flushes inside the window', () => {
    expect(shouldFlush(1000, 1000 + STREAM_FLUSH_MS - 1, false)).toBe(false);
  });
  it('flushes once the window has elapsed', () => {
    expect(shouldFlush(1000, 1000 + STREAM_FLUSH_MS, false)).toBe(true);
  });
});
```

Run: `npx jest __tests__/chat/streamFlush.test.ts` → FAIL (`shouldFlush` not exported).

- [ ] **Step 2: Implement in `streamReducer.ts`** (below `reduceTurn`)

```ts
/** Minimum interval between streaming UI flushes — keeps long replies smooth. */
export const STREAM_FLUSH_MS = 60;

/** Gate for streaming UI updates: terminal events always flush; otherwise rate-limit. */
export function shouldFlush(lastFlushAt: number, now: number, done: boolean): boolean {
  return done || now - lastFlushAt >= STREAM_FLUSH_MS;
}
```

Run test → PASS.

- [ ] **Step 3: Wire into `index.tsx`**

1. Import `shouldFlush` from `@/ui/chat/streamReducer`.
2. Delete the scroll-on-messages effect (the `useEffect` with `flashListRef.current?.scrollToEnd` + 50 ms timer).
3. In `handleSend`, right after `setStreaming(true); setStatus('running');` — scroll once to the send:
   ```ts
   setTimeout(() => flashListRef.current?.scrollToEnd({ animated: true }), 50);
   ```
4. Throttle the loop body:
   ```ts
   let turn = initialTurn;
   let lastFlushAt = 0;
   try {
     const stream = adapterFor(activeAgent).sendMessage(text, { … });
     for await (const event of stream) {
       turn = reduceTurn(turn, event);
       if (cancelledRef.current) return;
       const now = Date.now();
       if (shouldFlush(lastFlushAt, now, turn.done)) {
         lastFlushAt = now;
         setMessages((prev) =>
           prev.map((m) =>
             m.id === agentId ? { id: agentId, role: 'agent', blocks: turnToBlocks(turn) } : m,
           ),
         );
       }
       if (turn.done) break;
     }
   } catch { … unchanged … }
   ```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` + `npm test` green.
- [ ] **Step 5: Commit** — `feat(chat): stop fighting the reader — throttled stream flushes, no forced scroll`

---

### Task 3: Stop button while streaming (slice B)

**Files:**
- Modify: `src/app/(app)/index.tsx`

**Interfaces:**
- Consumes: throttled loop from Task 2.

- [ ] **Step 1: Add stop plumbing**

1. `import { ArrowUp, Square } from 'lucide-react-native';`
2. Add ref: `const stopRef = useRef(false);`
3. At the top of `handleSend` (after the guard): `stopRef.current = false;`
4. First line inside the `for await` body: `if (stopRef.current) break;`
5. Handler:
   ```ts
   const handleStopStream = useCallback(() => {
     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
     stopRef.current = true;
   }, []);
   ```
6. After the loop, before settling: a reply stopped before any text arrived just disappears —
   ```ts
   if (stopRef.current && turn.text.trim() === '') {
     setStreaming(false);
     setStatus('idle');
     setMessages((prev) => prev.filter((m) => m.id !== agentId));
     return;
   }
   ```
   (Note: a stopped turn has `status: 'running'`, so it falls through to the normal settle path — partial text is settled and persisted like a finished reply. That is the intended behavior.)

- [ ] **Step 2: Swap the button**

```tsx
<Pressable
  onPress={streaming ? handleStopStream : handleSend}
  onPressIn={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    sendAnim.onPressIn();
  }}
  onPressOut={sendAnim.onPressOut}
  disabled={!streaming && !canSend}
  hitSlop={8}
  accessibilityRole="button"
  accessibilityLabel={streaming ? 'Stop reply' : 'Send message'}
  accessibilityState={{ disabled: !streaming && !canSend }}
>
  <Animated.View
    style={[styles.sendBtn, sendAnim.animStyle, !streaming && !canSend && styles.sendBtnDisabled]}
  >
    {streaming ? (
      <Square size={14} color={colors.onAccentBtn} fill={colors.onAccentBtn} strokeWidth={2} />
    ) : (
      <ArrowUp size={20} color={colors.onAccentBtn} strokeWidth={2.5} />
    )}
  </Animated.View>
</Pressable>
```

(`canSend` stays `input.trim().length > 0 && !streaming`.)

- [ ] **Step 3: Verify** — tsc + tests green.
- [ ] **Step 4: Commit** — `feat(chat): stop button while a reply streams; partial replies settle cleanly`

---

### Task 4: Copy any message (slice D)

**Files:**
- Modify: `src/ui/chat/types.ts` (`blocksToText`, `messageToText`)
- Test: `__tests__/chat/blocksToText.test.ts` (new)
- Create: `src/ui/chat/CopiedToast.tsx`
- Modify: `src/app/(app)/index.tsx` (long-press wiring + toast state)

**Interfaces:**
- Produces: `blocksToText(blocks: AgentBlock[]): string`, `messageToText(message: Message): string` (exported from `types.ts`); `<CopiedToast visible={boolean} />`.

- [ ] **Step 1: Failing test**

```ts
// __tests__/chat/blocksToText.test.ts
import { blocksToText, messageToText, type AgentBlock, type Message } from '@/ui/chat/types';

describe('blocksToText', () => {
  it('joins mixed blocks as readable plain text', () => {
    const blocks: AgentBlock[] = [
      { kind: 'heading', text: 'Deploy status' },
      { kind: 'text', spans: [{ text: 'All ' }, { text: 'green', code: true }] },
      { kind: 'code', lines: [{ segments: [{ text: 'npm run deploy' }] }] },
      { kind: 'markdown', source: '## Next steps' },
    ];
    expect(blocksToText(blocks)).toBe('Deploy status\n\nAll green\n\nnpm run deploy\n\n## Next steps');
  });
  it('skips empty blocks and uses file source for file blocks', () => {
    const blocks: AgentBlock[] = [
      { kind: 'markdown', source: '   ' },
      { kind: 'file', file: { name: 'a.md', source: '# Doc', sizeLabel: '5 B', lineCount: 1 } },
    ];
    expect(blocksToText(blocks)).toBe('# Doc');
  });
});

describe('messageToText', () => {
  it('handles all three roles', () => {
    const user: Message = { id: '1', role: 'user', text: 'hi' };
    const action: Message = { id: '2', role: 'action', title: 'Run?', command: 'rm -rf /tmp/x' };
    expect(messageToText(user)).toBe('hi');
    expect(messageToText(action)).toBe('Run?\nrm -rf /tmp/x');
  });
});
```

Run → FAIL (not exported).

- [ ] **Step 2: Implement in `types.ts`** (near `codeToText`)

```ts
/** Flatten agent blocks to plain copyable text. */
export function blocksToText(blocks: AgentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading': return b.text;
        case 'text': return b.spans.map((s) => s.text).join('');
        case 'table':
          return b.rows.map((r) => `${r.service}  ${r.statusLabel}  ${r.p95}`).join('\n');
        case 'code': return codeToText(b.lines);
        case 'chip': return b.label;
        case 'file': return b.file.source;
        case 'markdown': return b.source;
      }
    })
    .filter((t) => t.trim().length > 0)
    .join('\n\n');
}

/** Plain copyable text for any thread message. */
export function messageToText(message: Message): string {
  if (message.role === 'user') return message.text;
  if (message.role === 'action') return `${message.title}\n${message.command}`;
  return blocksToText(message.blocks);
}
```

Run → PASS.

- [ ] **Step 3: `CopiedToast` component**

```tsx
// src/ui/chat/CopiedToast.tsx
/**
 * Transient "Copied" confirmation — a small muted pill that fades in above the
 * composer after a long-press copy, then fades away on its own.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors, radius, space, typography } from '../../theme';

export function CopiedToast({ shownAt }: { shownAt: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shownAt) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [shownAt, opacity]);

  if (!shownAt) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { opacity }]}>
      <Text style={styles.label}>Copied</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
  },
  label: {
    ...typography.caption,
    color: colors.ink,
  },
});
```

- [ ] **Step 4: Wire long-press in `index.tsx`**

1. Imports: `import * as Clipboard from 'expo-clipboard';`, `messageToText` from `@/ui/chat/types`, `CopiedToast` from `@/ui/chat/CopiedToast`.
2. State: `const [copiedAt, setCopiedAt] = useState(0);`
3. Handler:
   ```ts
   const handleCopyMessage = useCallback((message: Message) => {
     const text = messageToText(message);
     if (!text) return;
     Clipboard.setStringAsync(text).catch(() => {});
     Haptics.selectionAsync().catch(() => {});
     setCopiedAt(Date.now());
   }, []);
   ```
4. `MessageRow` gains `onCopy: (m: Message) => void`. User row: wrap the bubble `View` in a `Pressable` with `onLongPress={() => onCopy(message)}`. Agent row: wrap the `View style={styles.block}` content in `Pressable onLongPress={() => onCopy(message)}` (action rows are excluded — their buttons own the touch surface).
5. Render `<CopiedToast shownAt={copiedAt} />` as a sibling directly after `</KeyboardAvoidingView>` inside the SafeAreaView.

- [ ] **Step 5: Verify** — tsc + tests green. Nested link/copy taps still work (Pressable long-press doesn't consume child taps).
- [ ] **Step 6: Commit** — `feat(chat): long-press copies any message, with a quiet Copied toast`

---

### Task 5: Markdown type ramp + quiet bullets (slice C)

**Files:**
- Modify: `src/ui/chat/richMarkdown.tsx`
- Test: extend `__tests__/markdownRender.test.tsx`

- [ ] **Step 1: Failing test** (append to `markdownRender.test.tsx`)

```tsx
import { StyleSheet } from 'react-native';

describe('type ramp', () => {
  it('renders ## as a real 20px heading, not an uppercase label', async () => {
    render(<RichMarkdown source={'## Section title'} />);
    const el = await waitFor(() => screen.getByText('Section title'));
    const style = StyleSheet.flatten(el.props.style);
    expect(style.fontSize).toBe(20);
    expect(style.textTransform).toBeUndefined();
  });
  it('renders body text at 17px to match the thread', async () => {
    render(<RichMarkdown source={'Plain paragraph.'} />);
    const el = await waitFor(() => screen.getByText('Plain paragraph.'));
    expect(StyleSheet.flatten(el.props.style).fontSize).toBe(17);
  });
});
```

Run: `npx jest __tests__/markdownRender.test.tsx` → FAIL (13 / 16).

- [ ] **Step 2: Update `mdStyles`**

```ts
body: { color: colors.ink, fontSize: 17, lineHeight: 24 },
paragraph: { marginTop: 0, marginBottom: space.md, fontSize: 17, lineHeight: 24, color: colors.ink },
heading1: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4, color: colors.ink, marginTop: space.xs, marginBottom: space.sm + 1 },
heading2: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2, color: colors.ink, marginTop: space.lg, marginBottom: space.sm },
heading3: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.ink, marginTop: space.md, marginBottom: space.xs + 2 },
```

And in `s` (component-local styles):
- `bullet`: `backgroundColor: colors.accent` → `colors.faint`.
- `olMarker`: `fontSize: 16` → `17`.

- [ ] **Step 3: Verify** — targeted test PASS, then full `npm test` + tsc green.
- [ ] **Step 4: Commit** — `feat(markdown): real heading ramp (24/20/17), 17px body, quiet grey bullets`

---

### Task 6: Rename / delete chats (slice E)

**Files:**
- Create: `src/ui/chat/sessionActions.ts`
- Test: `__tests__/chat/sessionActions.test.ts` (new)
- Modify: `src/ui/chat/Sidebar.tsx`
- Modify: `src/app/(app)/index.tsx`

**Interfaces:**
- Produces: `renameSession(repo: Repository, sessionId: string, title: string): Promise<boolean>`.
- Sidebar gains props `onRenameChat(id: string, title: string): void` and `onDeleteChat(id: string): void`.

- [ ] **Step 1: Failing test**

```ts
// __tests__/chat/sessionActions.test.ts
import { MemoryRepository } from '@/db/memory';
import { renameSession } from '@/ui/chat/sessionActions';
import type { ChatSession } from '@/agents/types';

function session(id: string): ChatSession {
  const now = Date.now();
  return { id, agentId: 'a1', title: 'Old title', remoteSessionKey: null, createdAt: now, updatedAt: now };
}

describe('renameSession', () => {
  it('trims and saves a new title', async () => {
    const repo = new MemoryRepository();
    await repo.upsertSession(session('s1'));
    expect(await renameSession(repo, 's1', '  New title  ')).toBe(true);
    expect((await repo.getSession('s1'))?.title).toBe('New title');
  });
  it('rejects empty titles and missing sessions', async () => {
    const repo = new MemoryRepository();
    await repo.upsertSession(session('s1'));
    expect(await renameSession(repo, 's1', '   ')).toBe(false);
    expect(await renameSession(repo, 'nope', 'X')).toBe(false);
    expect((await repo.getSession('s1'))?.title).toBe('Old title');
  });
});
```

(Adjust the `ChatSession` literal to the real type if fields differ — check `src/agents/types.ts`.)
Run → FAIL (module missing).

- [ ] **Step 2: Implement `sessionActions.ts`**

```ts
/**
 * Session mutations behind the sidebar's long-press actions. Pure repo logic,
 * kept out of the screen so it is unit-testable.
 */
import type { Repository } from '@/db/repository';

/** Rename a session (trimmed). Returns false for empty titles or unknown ids. */
export async function renameSession(
  repo: Repository,
  sessionId: string,
  title: string,
): Promise<boolean> {
  const trimmed = title.trim();
  if (!trimmed) return false;
  const session = await repo.getSession(sessionId);
  if (!session) return false;
  await repo.upsertSession({ ...session, title: trimmed, updatedAt: Date.now() });
  return true;
}
```

Run → PASS.

- [ ] **Step 3: Sidebar long-press UI**

In `Sidebar.tsx`:
1. Imports: `Modal`, `Platform`, `ActionSheetIOS`, `Alert` from `react-native`.
2. New props: `onRenameChat: (id: string, title: string) => void; onDeleteChat: (id: string) => void;`.
3. State: `const [renameTarget, setRenameTarget] = useState<ChatSummary | null>(null);` and `const [renameText, setRenameText] = useState('');`.
4. Long-press handler:
   ```ts
   const handleChatActions = useCallback((chat: ChatSummary) => {
     const openRename = () => { setRenameTarget(chat); setRenameText(chat.title); };
     const confirmDelete = () =>
       Alert.alert('Delete chat', 'This removes the conversation from this device.', [
         { text: 'Cancel', style: 'cancel' },
         { text: 'Delete', style: 'destructive', onPress: () => onDeleteChat(chat.id) },
       ]);
     if (Platform.OS === 'ios') {
       ActionSheetIOS.showActionSheetWithOptions(
         { options: ['Cancel', 'Rename', 'Delete'], destructiveButtonIndex: 2, cancelButtonIndex: 0, title: chat.title },
         (i) => { if (i === 1) openRename(); if (i === 2) confirmDelete(); },
       );
     } else {
       Alert.alert(chat.title, undefined, [
         { text: 'Rename', onPress: openRename },
         { text: 'Delete', style: 'destructive', onPress: confirmDelete },
         { text: 'Cancel', style: 'cancel' },
       ]);
     }
   }, [onDeleteChat]);
   ```
5. `ChatRow` gains `onLongPress` prop; its `Pressable` gets `onLongPress={onLongPress}`; the list passes `onLongPress={() => handleChatActions(chat)}`.
6. Rename modal at the end of the panel (inside the root `View`):
   ```tsx
   <Modal visible={renameTarget !== null} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
     <View style={styles.modalScrim}>
       <View style={styles.modalCard}>
         <Text style={styles.modalTitle}>Rename chat</Text>
         <TextInput
           style={styles.modalInput}
           value={renameText}
           onChangeText={setRenameText}
           autoFocus
           selectTextOnFocus
           returnKeyType="done"
           onSubmitEditing={() => { if (renameTarget) onRenameChat(renameTarget.id, renameText); setRenameTarget(null); }}
           accessibilityLabel="Chat name"
         />
         <View style={styles.modalActions}>
           <Pressable onPress={() => setRenameTarget(null)} style={({ pressed }) => [styles.modalBtn, pressed && styles.pressable]}>
             <Text style={styles.modalBtnText}>Cancel</Text>
           </Pressable>
           <Pressable
             onPress={() => { if (renameTarget) onRenameChat(renameTarget.id, renameText); setRenameTarget(null); }}
             style={({ pressed }) => [styles.modalBtn, styles.modalBtnPrimary, pressed && { opacity: 0.9 }]}
           >
             <Text style={styles.modalBtnPrimaryText}>Save</Text>
           </Pressable>
         </View>
       </View>
     </View>
   </Modal>
   ```
   Styles (tokens only):
   ```ts
   modalScrim: { flex: 1, backgroundColor: colors.scrim, opacity: undefined, alignItems: 'center', justifyContent: 'center', padding: space.xl },
   modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.drawer, borderWidth: 1, borderColor: colors.line, borderRadius: radius.input, padding: space.lg, gap: space.md },
   modalTitle: { ...typography.small, fontWeight: '600', color: colors.ink },
   modalInput: { ...typography.body, color: colors.ink, height: 44, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.control, paddingHorizontal: space.md },
   modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
   modalBtn: { height: 38, paddingHorizontal: space.lg, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
   modalBtnPrimary: { backgroundColor: colors.ink },
   modalBtnText: { ...typography.small, color: colors.muted },
   modalBtnPrimaryText: { ...typography.small, fontWeight: '600', color: colors.onAccentBtn },
   ```
   For the scrim use `backgroundColor: colors.scrim` with container `style={[styles.modalScrim]}` and add `opacity` via rgba? No — keep it simple: give `modalScrim` `backgroundColor: 'rgba(0,0,0,0.55)'` is raw — instead reuse the drawer pattern: plain `colors.scrim` view with `opacity: 0.55` is wrong (dims card too). Use two layers like the drawer: an absolute-fill `Animated`-free `View` with `backgroundColor: colors.scrim, opacity: 0.55` behind a centered card container with `backgroundColor: 'transparent'`.

- [ ] **Step 4: Wire `index.tsx`**

```ts
import { renameSession } from '@/ui/chat/sessionActions';

const handleRenameChat = useCallback(
  async (id: string, title: string) => {
    const ok = await renameSession(repo, id, title);
    if (ok) await loadSessionSummaries();
  },
  [repo, loadSessionSummaries],
);

const handleDeleteChat = useCallback(
  async (id: string) => {
    await repo.deleteSession(id);
    if (sessionRef.current?.id === id) {
      sessionRef.current = null;
      setActiveSessionId('');
      setMessages([]);
      setStreaming(false);
      setStatus('idle');
    }
    await loadSessionSummaries();
  },
  [repo, loadSessionSummaries],
);
```

Pass `onRenameChat={handleRenameChat}` and `onDeleteChat={handleDeleteChat}` to `<Sidebar …>`.

- [ ] **Step 5: Verify** — tsc + tests green.
- [ ] **Step 6: Commit** — `feat(sidebar): long-press to rename or delete a chat`

---

### Task 7: Unified `ScreenHeader` (slice F)

**Files:**
- Create: `src/ui/ScreenHeader.tsx`
- Test: `__tests__/ui/screenHeader.test.tsx` (new)
- Modify: `src/ui/settings/index.tsx`, `src/app/(app)/cron.tsx`, `src/ui/cron/CronDetail.tsx`, `src/app/(app)/pair.tsx`

**Interfaces:**
- Produces:
  ```ts
  function ScreenHeader(props: {
    title: string;
    subtitle?: React.ReactNode; // string gets the standard muted caption style
    onBack?: () => void;        // default: router.back()
    right?: React.ReactNode;    // trailing accessories (e.g. pause + Run)
  }): JSX.Element
  ```

- [ ] **Step 1: Failing test**

```tsx
// __tests__/ui/screenHeader.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScreenHeader } from '@/ui/ScreenHeader';

it('renders title, subtitle, accessory, and fires onBack', () => {
  const onBack = jest.fn();
  render(<ScreenHeader title="Cron Drops" subtitle="3 active" onBack={onBack} right={<Text>R</Text>} />);
  expect(screen.getByText('Cron Drops')).toBeTruthy();
  expect(screen.getByText('3 active')).toBeTruthy();
  expect(screen.getByText('R')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Back'));
  expect(onBack).toHaveBeenCalled();
});
```

Run → FAIL (module missing).

- [ ] **Step 2: Implement**

```tsx
// src/ui/ScreenHeader.tsx
/**
 * The one screen header — back · title (+ optional subtitle) · optional
 * trailing accessories. Every pushed screen (settings, cron, pair) uses this
 * so chrome type, spacing, and the back affordance are identical app-wide.
 * The chat screen keeps its specialized header (menu · status · new chat).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { colors, radius, space, typography } from '@/theme';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
      >
        <ChevronLeft size={22} color={colors.muted} strokeWidth={1.9} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle == null ? null : typeof subtitle === 'string' ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pressed: {
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
});
```

Run test → PASS.

- [ ] **Step 3: Adopt**

1. `src/ui/settings/index.tsx` — `SettingsScreen` body becomes:
   ```tsx
   <SafeAreaView style={styles.safe} edges={['top']}>
     <ScreenHeader title={title} />
     {children}
   </SafeAreaView>
   ```
   Delete its local header/backBtn/headerTitle styles and the now-unused `ChevronLeft`/`Pressable`/`router` imports (keep what `Row` still needs — `Pressable`, `ChevronRight`, `router` is unused after this).
2. `cron.tsx` — replace the header `View` (titleRow + subtitleRow) with:
   ```tsx
   <ScreenHeader
     title="Cron Drops"
     onBack={handleLeave}
     subtitle={
       <View style={styles.subtitleRow}>
         <View style={[styles.summaryDot, running && styles.summaryDotRunning]} />
         <Text style={styles.subtitle}>
           {loading ? 'loading schedules' : `${summary.count} active schedules · ${summary.due}`}
         </Text>
       </View>
     }
   />
   ```
   where `const running = jobs.some((j) => j.state === 'running');`, `subtitleRow` loses its `paddingLeft: 28` and `marginTop` becomes `2`, `summaryDot` base color becomes `colors.muted` with `summaryDotRunning: { backgroundColor: colors.accent }` (slice G's state-aware dot lands here). Delete `header`, `titleRow`, `backBtn`, `title` styles and the `ChevronLeft` import.
3. `CronDetail.tsx` — replace its header `View` with:
   ```tsx
   <ScreenHeader
     title={job.name}
     subtitle={job.schedule.display}
     onBack={onBack}
     right={
       <View style={styles.headerActions}>
         {job.state !== 'running' && (
           /* existing pause/resume Pressable unchanged */
         )}
         {/* existing Run Pressable unchanged */}
       </View>
     }
   />
   ```
   with `headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs }`. Delete `header`, `backBtn`, `headerCenter`, `headerTitle`, `headerSub` styles and the `ChevronLeft` import.
4. `pair.tsx` — replace its header `View` with `<ScreenHeader title="Connect your agent" onBack={() => router.replace('/(app)/connect')} />`; delete local `header`, `backBtn`, `headerTitle` styles and the `ChevronLeft` import.

- [ ] **Step 4: Verify** — tsc + full tests green.
- [ ] **Step 5: Commit** — `feat(ui): one ScreenHeader for cron, settings, and pair`

---

### Task 8: Pair screen flow (slice H)

**Files:**
- Modify: `src/app/(app)/pair.tsx`

- [ ] **Step 1: Two steps, keyboard-safe**

1. Wrap the `ScrollView` in `<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>` (import `KeyboardAvoidingView`, `Platform`).
2. Remove `autoFocus` from the name input.
3. Restructure sections:
   - **Step 1 header:** number `1`, title `Install the connector`. Under it: the agent-prompt card (unchanged), then a muted caption `Or run it yourself in a terminal` (style: `...typography.caption, color: colors.muted, paddingHorizontal: 4, marginTop: space.sm`), then the curl card (unchanged) — all one section, no second step number.
   - **Step 2 header:** number `2`, title `Name and pair` (subtitle text unchanged).
4. Update the intro copy to match reality: `Pair Summit with your agent in two steps. Paste the prompt into your agent, then enter the code it gives you back.` (already says two steps — now true).

- [ ] **Step 2: Verify** — tsc + tests green.
- [ ] **Step 3: Commit** — `fix(pair): honest two-step flow, no keyboard slam, code field stays visible`

---

### Task 9: Residual polish + final verification (slice G remainder)

**Files:**
- Modify: `src/app/(app)/settings.tsx`, `src/ui/chat/Header.tsx`, `src/ui/chat/Sidebar.tsx`, `src/ui/cron/CronDetail.tsx`, `src/app/(app)/cron.tsx`
- Modify: `.sdd/progress.md`

- [ ] **Step 1: Display-name input breathing room** — `settings.tsx` `nameInput`: replace `minWidth: 116, maxWidth: 150` with `flex: 1, maxWidth: 190`, and `borderRadius: 10` → `radius.control`.

- [ ] **Step 2: Radii convergence (small controls → `radius.control`)**
- `Header.tsx` `iconBtn: borderRadius 11` → `radius.control`.
- `Sidebar.tsx` `row: borderRadius 11` → `radius.control`.
- `CronDetail.tsx` `iconBtn: 10` (already), `runBtn: borderRadius 9` → `radius.control`.
- `cron.tsx` `stateBtn: borderRadius 11` → `radius.control`; `backBtn` was removed in Task 7.
(Import `radius` where missing.)

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit` → clean. `npm test` → all suites green (111 baseline + new). `npm run lint` → clean.

- [ ] **Step 4: Progress log** — append to `.sdd/progress.md`:
`Task: UI polish & flow pass — complete (spec docs/superpowers/specs/2026-07-03-ui-polish-design.md; throttled stream flushes + reader-respecting scroll, stop-while-streaming, 24/20/17 markdown ramp + 17px body + grey bullets, long-press copy with toast, sidebar rename/delete, shared ScreenHeader across cron/settings/pair, success/scrim/control tokens, robot mark removed, two-step pair screen with keyboard avoidance; tsc + test green).`

- [ ] **Step 5: Commit** — `polish(ui): radii convergence, display-name input room, progress log`
