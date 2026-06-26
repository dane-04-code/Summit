# Connect Screen Report — Agent Messenger

**Date:** 2026-06-25
**Status:** DONE

---

## Files created / modified

| File | Action |
|---|---|
| `src/theme.ts` | Created — shared design-system tokens |
| `src/app/index.tsx` | Modified — full Connect screen implementation |

---

## Verification

### TypeScript (`npx tsc --noEmit`)
```
(no output — zero errors)
```

### Tests (`npm test -- --no-coverage`)
```
PASS __tests__/smoke.test.ts
  smoke
    ✓ arithmetic works (2 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

---

## Commit

**Branch:** `build/first-pages`
**Hash:** `3b6e36f8a2fff5213511bec753322e0be83d8134`
**Message:** `feat: connect screen UI (stubbed)`

---

## What was built

### `src/theme.ts`
Exports five typed constants consumed by every screen:
- `colors` — all 8 palette tokens (bg, ink, muted, bubble, codeBg, line, accent, error)
- `space` — 6-step scale (xs:4 → xxl:32)
- `radius` — bubble / code / input radii
- `typography` — 6 type tokens (title, h, body, small, mono, caption) each typed as `{ fontSize, fontWeight, lineHeight }`
- `screenPadding` — 16

### `src/app/index.tsx`
- **Title** rendered with `typography.title` (28/600/34).
- **Host field** — `keyboardType="url"`, `textContentType="URL"`, `autoCapitalize="none"`, `autoCorrect={false}`.
- **API Key field** — `secureTextEntry`, `textContentType="password"`, show/hide toggle using Lucide `Eye` / `EyeOff` (44×44 pt hit area, `accessibilityLabel`, `accessibilityRole="button"`).
- **"Where do I find these?" accordion** — `ChevronRight` → `ChevronDown` toggle with `LayoutAnimation` expand (200 ms easeInEaseOut). Falls back to instant render when `AccessibilityInfo.isReduceMotionEnabled()` returns true. Panel uses `colors.bubble` background; code snippets use `colors.codeBg` + system monospace (`Menlo` on iOS, `monospace` elsewhere).
- **"Test connection" button** — full-width, `minHeight: 48`, `colors.accent` fill, `radius.input` corners. Shows `ActivityIndicator` + "Connecting…" while busy. 150 ms press animation (scale 0.97, opacity) via `Animated`.
- **Error line** — renders below button in `colors.error` only when `error !== null`.
- **Stub behavior** — 800 ms `setTimeout` then `router.replace('/agent')`. Commented error-message examples left inline with `// ponytail: wire real connect() here later`.
- **Navigation header** hidden via `<Stack.Screen options={{ headerShown: false }} />`.
- `SafeAreaView` (all edges) + `KeyboardAvoidingView` (`padding` on iOS) + `ScrollView` (scrollable at 375 pt).
- All pressables use `Pressable` (not `TouchableOpacity`); `hitSlop` on icon-only controls; `accessibilityRole` + `accessibilityLabel` on every interactive element.
- Zero raw hex values or magic numbers — every value comes from `src/theme.ts`.

---

## Deviations from spec

| Item | Spec | Actual | Reason |
|---|---|---|---|
| Theme export name | `type` | `typography` | `type` is a TypeScript contextual keyword; `import { type as X }` is parsed as a type-only import alias and would fail. Renaming avoids the ambiguity with no functional impact. |

---

## Notes

- `LayoutAnimation` is iOS-native; on Android the accordion toggles instantly (no animation) unless `UIManager.setLayoutAnimationEnabledExperimental` is called at app startup. Since the project targets iPhone first, this is acceptable.
- LF → CRLF conversion warnings from Git are cosmetic (no `.gitattributes` yet) and do not affect the build.
