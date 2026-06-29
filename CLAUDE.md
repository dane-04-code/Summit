# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Use the minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it; don't delete it.

When your changes create orphans:
- Remove imports, variables, or functions that your changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

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

### Connection modes — both are now built

- **Slice 1 — direct mode.** `src/app/(app)/connect.tsx`: host + API key, calls Hermes directly.
  Works only where the host is reachable (LAN / Tailscale / tunnel). (`ONBOARDING.md`)
- **Slice 3a — relay mode.** `src/app/(app)/pair.tsx` is the **primary onboarding** path. A Go
  **connector sidecar** (`/connector/`) runs next to Hermes and dials outbound to a Cloudflare Worker
  relay (`/relay/`); the app pairs with a **6-digit code** over WebSocket. Shared frame types are in
  `/protocol/`. `RELAY_WS_URL` in `src/config.ts` is `ws://localhost:8787` in dev and
  `wss://relay.summitapp.dev` in prod. **Not yet deployed** to Cloudflare (`wrangler deploy` is
  slice 3c), and the agent-assisted install script (`get.summitapp.dev/connect`) is not yet built.

The no-agent guard in `src/app/(app)/_layout.tsx` redirects to `/pair` (relay-first). The connect
screen is the "advanced" escape hatch, linked from the pair screen.

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
