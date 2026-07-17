# STACK.md

The technology stack for Summit — what we use for each part of the build, and **why**.
This is the decision record. When you reach for a new dependency, check here first; if it's not
listed, it's either a deliberate non-choice (see the bottom) or a decision that needs making.

**Guiding constraints** (from `CLAUDE.md`, `DESIGN_SYSTEM.md`, `PRD.md` and the memory):
- **Lean over feature-rich.** Every dependency is native weight, a security surface, and a thing
  that breaks on the next Expo upgrade. Default to the platform/Expo before adding a library.
- **Privacy-first.** Nothing leaves the phone except calls to the user's *own* server. This rules
  out most analytics/crash SaaS by default (see *Observability*).
- **iOS-first, dark-only, clean.** No UI kits, no theming frameworks — the design system is
  enforced in code (`src/theme.ts`).
- **Expo SDK 56** is the floor. Read the [v56 docs](https://docs.expo.dev/versions/v56.0.0/) before
  adding or upgrading anything.

Legend: ✅ in use today · 🔜 planned / decided, not yet wired · 🤔 under consideration · 🚫 deliberately not using.

---

## At a glance

| Area | Choice | Status |
|---|---|---|
| Runtime | Expo SDK 56 · React Native 0.85 · React 19 | ✅ |
| Language | TypeScript 6 (strict) | ✅ |
| Routing | `expo-router` (file-based, typed routes) | ✅ |
| UI primitives | React Native core + `@expo/ui` | ✅ |
| Design tokens | `src/theme.ts` (hand-rolled, no UI kit) | ✅ |
| Lists | `@shopify/flash-list` | ✅ |
| Animation | `react-native-reanimated` 4 + `react-native-worklets` + `react-native-gesture-handler` | ✅ |
| Icons | `lucide-react-native` | ✅ |
| Images | `expo-image` | ✅ |
| Markdown | `react-native-markdown-display` | ✅ |
| Haptics / Clipboard | `expo-haptics` · `expo-clipboard` | ✅ |
| Networking (REST) | native `fetch` + thin typed client | 🔜 |
| Streaming (SSE) | `react-native-sse` | ✅ |
| Response validation | `zod` | 🔜 |
| Client/global state | React state/context; `zustand` for the small global store | 🔜 |
| Server-state caching | none yet (thin hooks); `@tanstack/react-query` is the escape hatch | 🤔 |
| Secure storage | `expo-secure-store` (iOS Keychain) | ✅ |
| Local persistence | `expo-sqlite` (transcripts) · MMKV/AsyncStorage (prefs) | 🔜 |
| Deep linking | `expo-linking` (scheme `agentmessenger`) | ✅ |
| Unit/component tests | Jest + `jest-expo` + Testing Library | ✅ |
| E2E tests | Maestro | 🔜 |
| Lint / format | ESLint 9 (`eslint-config-expo`) + Prettier | ✅ / 🔜 |
| Build & submit | EAS Build + EAS Submit (`eas.json`) | ✅ |
| OTA updates | EAS Update | 🔜 |
| CI | GitHub Actions (tsc + jest + lint) | 🔜 |
| Crash/analytics | None by default (privacy); opt-in Sentry if ever | 🚫 / 🤔 |
| Push notifications | `expo-notifications` — blocked on the relay | 🔜 |

---

## Core runtime & language

**Expo SDK 56 · React Native 0.85 · React 19.2 · TypeScript 6 (strict).** Already set, not up for
debate. The two experiments in `app.json` shape how we write code:

- **`reactCompiler: true`** — the React Compiler auto-memoizes. **Don't hand-add `useMemo`/`useCallback`/`memo`** for performance; only keep them where they're load-bearing for correctness (e.g. stable
  callback identity feeding an effect, as in `src/app/index.tsx`). Follow the rules of hooks strictly.
- **`typedRoutes: true`** — route strings are typechecked; lean on it instead of stringly-typed nav.

`expo-dev-client` is installed, so we're already off Expo Go and **can use any native module** that has
a config plugin — that unblocks MMKV, Sentry, etc. without ejecting.

## Navigation & routing — `expo-router`

File-based routing under `src/app/`. Entry is `expo-router/entry`. One `Stack` in `_layout.tsx`.
No React Navigation directly (expo-router wraps it), no third-party nav. Path aliases `@/*` → `src/*`.

## UI, design system & styling — hand-rolled, no kit

The product is a **clean, minimal, dark-only, system-font** chat. That intent is hostile to component
kits, so:

- **`src/theme.ts` is the single source of truth** for color, spacing, radius, type. Import tokens
  (`colors`, `space`, `radius`, `typography`, `screenPadding`) — **never raw hex / magic numbers**.
- **`@expo/ui`** gives us native (SwiftUI/Jetpack) primitives when we want true platform feel.
- **`StyleSheet.create`** + the tokens. No Tailwind/NativeWind, no Tamagui, no styled-components — see
  non-choices.

Supporting UI libs already chosen: **`@shopify/flash-list`** for the message thread (long lists),
**`lucide-react-native`** for icons (single consistent set, tree-shakeable), **`expo-image`** for
images (inline images are the only media Hermes supports), **`expo-haptics`** for the tactile feel the
design leans on, **`expo-glass-effect`/`expo-symbols`/`expo-blur`-style** Expo modules for native iOS texture.

## Animation — Reanimated 4

`react-native-reanimated` 4 + `react-native-worklets` + `react-native-gesture-handler`. This is the
standard high-perf stack and what we'll use for new gesture/transition work (sidebar, message
entrance, the send button). Note: some existing screens still use RN's core `Animated` API
(`usePressAnim`, the composer focus border) — fine for simple, non-gesture tweens; **prefer Reanimated
for anything driven by gestures or that must run off the JS thread.**

## Markdown & code rendering

**`react-native-markdown-display`** renders agent replies. Markdown is the single most *visible*
upgrade over a raw Telegram bot, so it must look right (tie its styles to `theme.ts`).

- **Code-block syntax highlighting:** 🤔 deferred. Highlighters (`react-native-syntax-highlighter`,
  Shiki) are heavy and most agent code blocks are short. Ship monospace-on-`surface` first; only add a
  highlighter if real usage shows it matters. Keep it off the critical path.

---

## Hermes integration layer

Read `FRAMEWORKS.md` and the `hermes-expert` skill before touching any of this.

- **REST:** native **`fetch`** behind a thin, typed client (`AgentAdapter` interface in
  `FRAMEWORKS.md`). **No axios** — `fetch` covers everything, and `react-native-sse` already handles
  the one thing fetch can't (streaming). One less dependency.
- **Streaming:** **`react-native-sse`** ✅ for `/v1/chat/completions` (`stream: true`) and the Runs
  events stream. Handles the two Hermes SSE event types (`chat.completion.chunk`,
  `hermes.tool.progress`).
- **Response validation:** **`zod`** 🔜. The server is **self-hosted and version-drifting** — we probe
  `GET /v1/capabilities` precisely because we can't assume the shape. Validate `capabilities`, run
  status, and SSE payloads at the boundary so a weird server can't crash the UI. This is a deliberate
  safety choice, not ceremony.
- **Adapter pattern:** keep Hermes-specific headers/endpoints behind the `AgentAdapter` interface so
  the documented OpenClaw (v2) and relay-mode futures slot in without a UI rewrite.

## State management

- **Local/screen state:** React `useState`/`useReducer` + context. Most of the app is one chat screen;
  don't reach further than this until it hurts.
- **Global store:** **`zustand`** 🔜 for the small amount of genuinely global state — active
  connection, the list of configured servers (one-server-one-agent means we store *multiple* host+key
  pairs), and current session. Chosen over Redux/MobX for near-zero boilerplate and a tiny footprint
  that suits a clean app. **No Redux Toolkit** — overkill here.
- **Server-state / caching:** 🤔 none yet. The data flow is mostly a stream plus a few REST polls
  (`/v1/runs/{id}`, jobs, sessions). Thin hand-written hooks are enough for v1. **`@tanstack/react-query`** is the pre-approved escape hatch *if* polling/caching/retry logic starts sprawling —
  add it then, not now.

## Storage & persistence

- **Secrets (API keys, session keys):** **`expo-secure-store`** ✅ → iOS Keychain. The privacy promise
  depends on this; credentials never go anywhere else.
- **Transcript history:** **`expo-sqlite`** 🔜 when persisted history lands — structured, queryable,
  first-party Expo, scales to long threads better than a JSON blob.
- **Lightweight prefs (theme later, last-used server, flags):** **AsyncStorage** or
  **`react-native-mmkv`** 🔜. MMKV is faster and dev-client unblocks it; AsyncStorage is zero-config.
  Pick MMKV only if we feel the difference. **One small KV store, not two.**

---

## Tooling, quality & tests

- **Typecheck:** `npx tsc --noEmit`, strict on. Half of "the green bar."
- **Unit/component tests:** **Jest** + **`jest-expo`** + **`@testing-library/react-native`** ✅. The
  other half of the green bar. Test behavior through the component tree, not implementation details.
- **E2E (iOS-first):** **Maestro** 🔜 — simple YAML flows, far less setup/maintenance than Detox, and
  matches the iOS-first focus. Add when there's a real flow worth guarding (connect → chat → approve).
- **Lint:** **ESLint 9** + **`eslint-config-expo`** ✅ (`npm run lint`).
- **Format:** **Prettier** 🔜 — not yet a dependency; add it + an eslint-prettier bridge so formatting
  is mechanical, not bikeshed. (The codebase is already Prettier-shaped.)
- **Git hooks:** 🤔 optional later (Husky + lint-staged) to run tsc/lint/format pre-push. Skip until CI
  exists, then decide.

## Build, release & CI

- **Build & submit:** **EAS Build** + **EAS Submit** ✅ (`eas.json` — development/preview/production
  profiles, `appVersionSource: remote`, `autoIncrement`). iOS bundle id `com.dane.agentmessenger.siwa`.
- **OTA updates:** **EAS Update** 🔜 — ship JS-only fixes without an App Store round-trip. Pairs with
  EAS Build; wire the runtime version policy when we cut the first build.
- **CI:** **GitHub Actions** 🔜 — run `tsc --noEmit` + `jest` + `expo lint` on every PR (the green
  bar, automated), and trigger EAS builds on release branches.

## Observability & privacy — *a deliberate near-non-choice*

The product's whole pitch is "nothing leaves the phone except calls to your own server." That promise
is the feature, so we **do not** add analytics or crash SaaS that phones home by default.

- **Analytics:** 🚫 none. No Amplitude/PostHog/Firebase. If we ever need product signal, it must be
  opt-in and ideally on-device only.
- **Crash/error reporting:** 🚫 off by default. If crash reports become necessary, **Sentry
  (`@sentry/react-native`)** is the candidate — but only **opt-in**, with aggressive PII scrubbing
  (never log hosts, keys, or message content). Treat as a conscious privacy trade-off, documented, not
  a default.
- **Dev-time:** console + React Native DevTools + Expo's tooling are enough.

## Notifications, dates, misc

- **Push (run-approval alerts):** **`expo-notifications`** 🔜 but **blocked**: Hermes is inbound-only
  and can't dial out, so real push needs the **relay/connector** from `docs/CONNECTION.md` (not built).
  Don't design push against direct mode.
- **Deep linking:** **`expo-linking`** ✅, scheme `agentmessenger` — also the basis for the future
  6-digit relay pairing flow.
- **Dates/times:** native **`Intl`** (Hermes JS engine ships it). **No moment.js / date-fns / Day.js**
  unless formatting needs genuinely outgrow `Intl`.
- **Web browser / auth handoff:** `expo-web-browser`, `expo-linking` for any future OAuth-style flows.

---

## Deliberate non-choices (and why)

| Rejected | Instead | Why |
|---|---|---|
| Axios | native `fetch` (+ `react-native-sse`) | fetch + SSE already covers REST and streaming; one fewer dep |
| Redux / MobX | Zustand + React state | boilerplate vs. a tiny global store; app is mostly one screen |
| Tailwind / NativeWind / Tamagui / styled-components | `theme.ts` + `StyleSheet` | dark-only, hand-tuned, token-enforced design; kits fight the "invisible UI" goal |
| NativeBase / React Native Paper / any UI kit | custom components + `@expo/ui` | the look is bespoke and minimal; kits add weight + their own aesthetic |
| Detox | Maestro | simpler, less brittle, iOS-first |
| Analytics SaaS (PostHog/Amplitude/Firebase) | nothing | privacy positioning; data must not leave the device |
| moment.js / date-fns | native `Intl` | bundle size; Intl is enough |
| `npm run reset-project` | — | leftover create-expo-app script; **never run it** (blanks the source) |

---

## When you add or change a dependency

1. Check it's compatible with **Expo SDK 56 / RN 0.85 / React 19** (read the v56 docs, not old SDK docs).
2. Prefer an **Expo module** or the platform before a third-party lib.
3. Weigh it against the constraints at the top — especially **privacy** (does it phone home?) and
   **lean** (is the native weight worth it?).
4. **Update this file** — move it to ✅, or add it to the non-choices table if you rejected it.
