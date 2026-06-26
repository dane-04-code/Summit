# Scaffold Report — Agent Messenger

**Date:** 2026-06-25  
**Status:** DONE

---

## create-expo-app command

```
npx create-expo-app@latest . --template default --yes
```

Executed inside `C:\Agent Messaging\.scaffold-tmp`. Version installed: `create-expo-app@4.0.0`.  
Template used: `default` (includes TypeScript + Expo Router with `src/app` layout, React 19, RN 0.85, Expo 56).

---

## Steps performed

1. **Scaffold → relocate**: Ran `create-expo-app` in `.scaffold-tmp`, then moved all generated contents (excluding `.git` and the pre-existing `.claude` skills dir) up to repo root. `.scaffold-tmp` deleted.
2. **Strip starter**: Removed `src/components/`, `src/constants/`, `src/hooks/`, `src/global.css`, and `src/app/explore.tsx`. Rewrote `src/app/_layout.tsx` as a minimal `<Stack>` with three named screens. Wrote placeholder screens (`index.tsx`, `agent.tsx`, `settings.tsx`) — each is a SafeAreaView + centered Text only.
3. **Dependencies installed**:
   - Runtime via `npx expo install`: `react-native-sse`, `react-native-markdown-display`, `expo-secure-store`, `@shopify/flash-list`, `lucide-react-native`, `react-native-svg`, `expo-haptics`
   - Dev via `npm install -D`: `jest-expo@56.0.5`, `jest@29.7.0`, `@testing-library/react-native@14.0.1`, `@types/jest@30.0.0`
4. **Tooling configured**: `package.json` updated with `"test"` / `"test:watch"` scripts and `"jest"` block (preset, setupFilesAfterEnv, moduleNameMapper). `tsconfig.json` gains `"types": ["jest"]`.
5. **Smoke test**: `__tests__/smoke.test.ts` — trivial `1 + 1 === 2` assertion.
6. **Git**: initialised, branch `build/first-pages` created, all files committed.

---

## Test result

```
npm test -- --no-coverage

PASS __tests__/smoke.test.ts
  smoke
    ✓ arithmetic works (2 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

---

## TypeScript result

```
npx tsc --noEmit
(no output — zero errors)
```

---

## Top-level directory listing (`C:\Agent Messaging`)

```
Directories:
  .claude/      (pre-existing Claude Code skills)
  .git/
  .sdd/         (this report)
  .vscode/
  __tests__/
  assets/
  docs/         (pre-existing)
  node_modules/
  scripts/
  src/

Files:
  .gitignore
  AGENTS.md
  app.json
  CLAUDE.md
  DESIGN_SYSTEM.md   (pre-existing doc — untouched)
  FRAMEWORKS.md      (pre-existing doc — untouched)
  jest-setup.ts
  LICENSE
  ONBOARDING.md      (pre-existing doc — untouched)
  package-lock.json
  package.json
  PRD.md             (pre-existing doc — untouched)
  README.md
  tsconfig.json
```

---

## Git

- **Branch:** `build/first-pages`
- **Commit hash:** `9426f61d9a68e7c31459930e64e149852b4ca8cc`
- **Message:** `chore: scaffold expo app + jest runner`

---

## Windows-specific notes

1. **PowerShell vs bash heredoc**: The bash `<<'EOF'` heredoc syntax fails in PowerShell — had to use the `@'...'@` here-string form for the git commit message.
2. **LF → CRLF warnings**: Git printed line-ending conversion warnings for all text files. These are cosmetic (`.gitattributes` could normalize them later) and did not affect the commit.
3. **@testing-library/react-native v14 compat**: v14 removed the `/extend-expect` top-level subpath export that older docs reference. Fixed by:
   - Adding `moduleNameMapper` in jest config to resolve the path at runtime.
   - Adding `src/types/testing-library.d.ts` with an ambient `declare module` to satisfy TypeScript.
   - Keeping `jest-setup.ts` content as specified (`import '@testing-library/react-native/extend-expect'`).
4. **Network**: All npm/npx installs completed successfully with no network errors.
