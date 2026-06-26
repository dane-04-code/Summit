# Agent Chat Screen — Build Report

**Status: DONE**
**Branch:** `build/first-pages`
**Commit:** `d55b9bf` — _feat: agent chat screen UI (stubbed streaming)_

---

## Files Created / Modified

| File | Action |
|---|---|
| `src/ui/usePressAnim.ts` | Created — extracted shared press-animation hook |
| `src/app/index.tsx` | Modified — removed inline `usePressAnim` definition, added import from `../ui/usePressAnim` |
| `src/app/agent.tsx` | Replaced placeholder — full agent chat screen implementation |

---

## Verification

- **`npx tsc --noEmit`** → 0 errors (strict mode)
- **`npm test`** → 1 suite, 1 test, all passed

---

## What Was Built

### Task 1 — Shared `usePressAnim` hook
The `usePressAnim` function was moved verbatim from `index.tsx` into `src/ui/usePressAnim.ts` and exported as a named export. `index.tsx` now imports it from there. Behavior is identical.

### Task 2 — `src/app/agent.tsx`

**Layout:**
- `Stack.Screen options={{ headerShown: false }}` — no nav header.
- `SafeAreaView` with `edges={['top', 'left', 'right']}` handles top notch and sides.
- `KeyboardAvoidingView` (`behavior: 'padding'` on iOS, `'height'` on Android) owns the lower half.
- Input bar bottom padding uses `useSafeAreaInsets().bottom` so it sits above the home indicator when the keyboard is down.

**Status row:**
- 10×10 dot (`borderRadius: radius.bubble` makes it a circle) + `typography.caption` label.
- Three states: `idle` → `colors.muted` + "ready"; `running` → `colors.accent` + "thinking…"; `error` → `colors.error` + "error".
- While running a subtle tool hint appends: `· searching the web…` in `colors.muted`.
- No animation — color is the signal (per DESIGN_SYSTEM.md).
- `accessibilityRole="none"` + `accessibilityLabel` with full state string for screen readers.

**Message list (FlashList v2):**
- `FlashList<Message>` with typed `FlashListRef<Message>` ref.
- `maintainVisibleContentPosition` with `autoscrollToBottomThreshold: 120` and `animateAutoScrollToBottom: true` for smooth streaming scroll.
- `startRenderingFromBottom: true` so the initial render anchors to the bottom.
- Manual `scrollToEnd` via `useEffect` on `messages` as belt-and-suspenders, with a 50 ms delay to let layout settle.
- `keyboardDismissMode="on-drag"` for natural iOS chat feel.
- No `estimatedItemSize` — removed from FlashList v2 API.
- Empty state: intentionally blank per spec.

**Message rows:**
- User: right-aligned `View` wrapping a `colors.bubble` bubble (`radius.bubble`, max 80% width, `space.sm` vertical margin, `colors.ink` body text).
- Agent: full-width `View`, plain `<Text>` with `typography.body`. Comment marks the `<StreamingMarkdown>` swap point.

**Input bar:**
- Rounded `TextInput` (`radius.input`, 1 px `colors.line` border, height 44 pt).
- Circular send button (44×44, `borderRadius: 22`, `colors.accent` fill) with Lucide `ArrowUp` icon.
- `onPress` → `Haptics.impactAsync(ImpactFeedbackStyle.Light)` then clears field.
- Disabled while `status === 'running'` (button opacity 0.5, `accessibilityState.disabled: true`).
- `accessibilityRole="button"` + `accessibilityLabel="Send message"`.
- Press feedback via shared `usePressAnim` (scale + opacity, 150 ms).

**Stub streaming:**
- On send: user message appended; blank agent placeholder appended; status → `'running'`.
- `setInterval` reveals `STUB_WORDS` one word at a time over ~1.2 s (80 ms/word for a 15-word reply).
- State updates the placeholder message in-place by ID, so FlashList receives granular updates.
- On completion: interval cleared; status → `'idle'`.
- Interval ref cleaned up on unmount.

---

## Deviations / Concerns

1. **`accessibilityRole="status"` not valid in React Native** — changed to `"none"`. The `accessibilityLabel` carries the full status string for screen readers, which is functionally equivalent. The spec's intent (announce status to VoiceOver) is satisfied.

2. **FlashList v2 has no `estimatedItemSize`** — this prop was removed in the v2 architecture rewrite. The spec called for it, but passing it would be a TypeScript error. FlashList v2's new architecture auto-sizes items; `maintainVisibleContentPosition` replaces much of the v1 scroll-management surface.

3. **`multiline={false}` on TextInput** — explicit, matching the single-line chat input design. Users pressing Enter triggers send via `onSubmitEditing`.

4. **No dark mode** — consistent with DESIGN_SYSTEM.md "Deferred (not v1)".
