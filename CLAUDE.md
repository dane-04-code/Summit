# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Delivery-status override (2026-07-21):** the relay is operating reliably in active testing and
> the native Hermes platform plugin is built in alpha. Treat the Go connector below as a compatibility
> fallback, not the only Hermes path. Current V1 work is mobile chat/output polish plus real-device
> proof of recovery, push, and proactive cron delivery. `docs/PROJECT_STATUS.md` and
> `docs/LAUNCH_PLAN.md` are the current product/release source of truth.

## Working Style

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs. LLMs often pick an interpretation silently
and run with it — this forces explicit reasoning:

- State assumptions explicitly — if uncertain, ask rather than guess.
- Present multiple interpretations — don't pick silently when ambiguity exists.
- Push back when warranted — if a simpler approach exists, say so.
- Stop when confused — name what's unclear and ask for clarification.

### 2. Goal-Driven Execution

Define success criteria. Loop until verified. Transform imperative tasks into verifiable goals:

| Instead of... | Transform to... |
|---|---|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant
clarification.

## Critical: Expo SDK 56

This project is on **Expo SDK 56** (`expo ~56`, React Native 0.85, React 19). Expo changes
significantly between versions. **Read the versioned docs at https://docs.expo.dev/versions/v56.0.0/
before writing any Expo/RN code** — APIs and config from older SDKs are often wrong here. (This is the
standing instruction in `AGENTS.md`.)

## Commands & Architecture

Moved to `docs/TECHNICAL_REFERENCE.md` (build/test commands, the green-bar rule, and what this app
is/how it's put together) — read it before touching build tooling or app architecture.

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