---
name: summit-device-qa
description: Use when it's time to run or check status on Summit's real-device test loop before a release — pairing, reconnect, background/restart recovery, push notifications, and notification taps, plus the automated layers underneath (Jest, Go connector tests, mock-agent loops). Use when Dane asks "is this ready to test," "let's run the QA loop," "what still needs testing before we ship," or when summit-release / summit-growth-command needs proof a build is actually solid, not just built. Distinguishes what can be verified without Dane from what genuinely needs him on a physical device.
---

# Summit Device QA

Directs the test loop already defined in `docs/TESTING.md` and the "Prove the plugin's useful operational loop" section of `docs/PROJECT_STATUS.md` — this skill doesn't replace those, it runs them consistently and reports status in one place. Re-read both before starting, since they're the source of truth and can move.

## Two tiers — know which one you're in

**Tier 1 — automated, no Dane needed.** Run these freely, any time, without asking:
- `npm test` (Jest — adapters, connect/framework detection)
- `go test ./...` in `/connector`
- `npm run loop5` / `node scripts/loop5-smoke.mjs` — pairs, registers a push token, round-trips a chat against the mock agent, entirely on-machine
- `node scripts/loop5-push-verify.mjs` — proves agent → connector → relay → Expo Push API fires, against a local sink, no phone required

**Tier 2 — needs a physical device, needs Dane.** Name these explicitly as blocking on him rather than silently trying to work around them (same discipline as the CTO skill's "Dane-in-the-loop" timeline bucket):
- Real push delivery and notification taps (`docs/TESTING.md` Loop 5b/5c) — needs a dev build with `expo-notifications` rebuilt in and an iOS APNs key set up
- Backgrounding/restarting the app mid-reply to confirm recovery
- Reconnect after killing/restarting the connector
- Any "does this feel right" check — visual/interaction quality isn't something to self-certify

## What "working" means (mirror of docs/TESTING.md's table — check it hasn't drifted before relying on this copy)

| Capability | Visible check |
|---|---|
| chat + streaming | reply renders progressively, stop button works |
| `hasJobs` | Cron Drops appears in the sidebar; absent for generic agents |
| `hasRunApproval` | approval cards render when the agent sends one |
| reconnect | kill the connector mid-session → badge shows disconnected → restart it → next send reconnects with the same code |
| push | background the app mid-reply → "finished a reply" push; `curl localhost:8643/notify` → agent nudge push |

## When something fails

Don't patch blindly. If a Tier 1 check fails, that's a real bug — reproduce it, then fix it like any other bug. If a Tier 2 check fails or the cause isn't obvious from the failure alone (especially anything touching the pairing/relay trust boundary or credentials), hand it to `summit-cto` for the security/architecture read rather than guessing at a fix under release pressure.

## Output

Return a status table: capability/check → tier (automated/physical-device) → pass / fail / not-yet-run → evidence (command output, or what Dane needs to do to produce evidence) → next action. Call out plainly which Tier 2 items are still open and blocking — don't bury them in a wall of green checks.
