# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Expo SDK 56

This project is on **Expo SDK 56** (`expo ~56`, React Native 0.85, React 19). Expo changes
significantly between versions. **Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/
before writing any Expo/RN code** — APIs and config from older SDKs are often wrong here. (This is the
standing instruction in `AGENTS.md`.)

## Commands

```bash
npm install                 # install deps
npm start                   # expo start (dev server + QR / dev menu)
npm run ios                 # open iOS simulator
npm run android             # open Android emulator
npm run web                 # web target

npm run lint                # expo lint
npm test                    # jest (jest-expo preset)
npm run test:watch          # jest --watch
npx jest __tests__/smoke.test.ts   # run a single test file
npx jest -t "partial name"         # run tests matching a name
npx tsc --noEmit            # typecheck (strict mode is ON)
```

**The green bar is `npx tsc --noEmit` + `npm test` both passing** — build slices are only considered
complete when typecheck and tests are green (see `.sdd/progress.md`).

**Do not run `npm run reset-project`** — it's a leftover create-expo-app script that moves the app
into `app-example/` and blanks the source. It is not part of this project's workflow.

## Architecture

**What this is:** a React Native (Expo, iOS-first) mobile client for self-hosted AI agents
(Hermes now, OpenClaw later). Users chat with their agent, see its status, and approve/stop blocking
runs from the phone.

**Routing & layout:**
- `expo-router` with **file-based routing**; entry is `expo-router/entry`. Screens live in
  **`src/app/`** (not root `app/`): `index.tsx` = Connect, `agent.tsx` = chat, `settings.tsx`,
  `_layout.tsx` = the `Stack`.
- Path aliases: `@/*` → `src/*`, `@/assets/*` → `assets/*`.
- Experiments on: `typedRoutes` and `reactCompiler` (React Compiler — don't hand-add memoization it
  already provides; do follow the rules of hooks strictly).

**Design system is enforced in code, not just documented:**
- `src/theme.ts` is the **single source of truth** for color, spacing, radius, and type. **Never use
  raw hex or magic numbers in components — import tokens** (`colors`, `space`, `radius`, `typography`,
  `screenPadding`). Note the type-scale export is named **`typography`** (not `type`, which collides
  with the TS keyword).
- `DESIGN_SYSTEM.md` is the spec behind those tokens. The product is **dark-only** (light mode is
  deferred, tokens are semantic so it's a later swap), system font everywhere, **one** restrained
  accent (`#5B9DFF`) used sparingly; the primary button is a light `ink` fill, not the accent.
  Whitespace over borders/boxes. Message layout is **hybrid**: user = right-aligned bubble on
  `surface`; agent = full-width, no bubble. Long lists use `@shopify/flash-list`.

**Hermes integration (see `FRAMEWORKS.md` before writing any integration code):**
- OpenAI-compatible API on port `8642`. Auth: `Authorization: Bearer <key>`.
- Connect probes `GET /v1/capabilities`. Chat is `POST /v1/chat/completions` with SSE streaming
  (`react-native-sse`), carrying `X-Hermes-Session-Id` + `X-Hermes-Session-Key` for continuity.
  Approve/stop use the Runs API (`/v1/runs/{id}/approval`, `/stop`); gate the approve UI on the
  `run_approval` flag from `/v1/capabilities` at runtime.
- **Hard Hermes constraints — don't design around them:** one server = one agent (no multi-agent
  endpoint); **no file upload** (inline images only); the `model` field is cosmetic; the server is
  **inbound-only** and can't dial out.
- Credentials are stored on-device only via `expo-secure-store` (iOS Keychain). Nothing leaves the
  phone except calls to the user's own server.

### Two connection models — know which one you're touching

There is a deliberate gap between what's **built** and the **target architecture**. Don't conflate
them or "fix" one to match the other unless that's the task:

- **Built today (Slice 1 / MVP): direct mode.** The Connect screen takes a host + API key and calls
  Hermes directly (`ONBOARDING.md` describes the implemented flow). This is what `src/app/index.tsx`
  does.
- **Documented target: relay-first** (`PRD.md` v0.2 + `docs/CONNECTION.md`). A small **connector
  sidecar** next to Hermes dials outbound to a relay we run; the app pairs with a **6-digit code**
  (Hermes can't dial out, so this is mandatory for off-WiFi use). Agent-assisted onboarding has the
  agent install its own connector. **This is not built yet.**

When in doubt about product intent vs. current implementation, the docs below are authoritative for
intent; the code is authoritative for what exists.

## Where product truth lives

| File | Holds |
|---|---|
| `PRD.md` | Full product spec, scope, phases, risks, open decisions (v0.2 = relay-first) |
| `FRAMEWORKS.md` | Hermes & OpenClaw API surfaces + hard constraints — read before integration code |
| `docs/CONNECTION.md` | Relay/connector architecture (the target, not yet built) |
| `ONBOARDING.md` | The connect flow as actually built (direct mode) |
| `DESIGN_SYSTEM.md` | Visual system — enforced by `src/theme.ts` |
| `.sdd/` and `docs/superpowers/{specs,plans}/` | Spec-driven build: progress log, specs, plans |
| `.claude/skills/nano-product-manager/` | Product-manager skill + `product-brief.md` for "what should we build / is X worth it" questions |

**Positioning to keep straight:** the product sells the *flow* — a fluent, first-class mobile
experience — not any single feature. Proper markdown rendering is the most *visible* upgrade over a
raw Telegram bot, but it is not "the point." Weigh features by whether they make the flow more fluent.
