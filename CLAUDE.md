# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Delivery-status override (2026-07-21):** the relay is operating reliably in active testing and
> the native Hermes platform plugin is built in alpha. Treat the Go connector below as a compatibility
> fallback, not the only Hermes path. Current V1 work is mobile chat/output polish plus real-device
> proof of recovery, push, and proactive cron delivery. `docs/PROJECT_STATUS.md` and
> `docs/LAUNCH_PLAN.md` are the current product/release source of truth.

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

Standard commands are in `package.json` scripts (`start`, `ios`, `android`, `web`, `lint`, `test`, `test:watch`).
Non-obvious ones:

```bash
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

Two connection modes are built: relay mode (primary onboarding, via a Go connector sidecar +
Cloudflare Worker relay) and direct mode (advanced fallback, host + API key). The design system is
enforced in code via `src/theme.ts`, not just documented. Full detail on routing/layout, the
design-system enforcement rules, Hermes integration, the multi-agent tier architecture, and both
connection modes lives in `docs/TECHNICAL_REFERENCE.md` — read it before touching any of those areas.

When in doubt about product intent vs. current implementation, the docs below are authoritative for
intent; the code is authoritative for what exists.

## Where product truth lives

| File | Holds |
|---|---|
| `PRD.md` | Full product spec, scope, phases, risks, open decisions (v0.2 = relay-first) |
| `docs/TECHNICAL_REFERENCE.md` | Routing, design-system enforcement, Hermes integration, multi-agent tiers, connection modes |
| `FRAMEWORKS.md` | Hermes & OpenClaw API surfaces + hard constraints — read before integration code |
| `docs/CONNECTION.md` | Relay/connector architecture (the target, not yet built) |
| `ONBOARDING.md` | The connect flow as actually built (direct mode) |
| `DESIGN_SYSTEM.md` | Visual system — enforced by `src/theme.ts` |
| `docs/TESTING.md` | Tester loops per connection channel + the mock agent (`scripts/mock-agent.mjs`) |
| `.sdd/` and `docs/superpowers/{specs,plans}/` | Spec-driven build: progress log, specs, plans |

**Positioning to keep straight:** the product sells the *flow* — a fluent, first-class mobile
experience — not any single feature. Proper markdown rendering is the most *visible* upgrade over a
raw Telegram bot, but it is not "the point." Weigh features by whether they make the flow more fluent.
