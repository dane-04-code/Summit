---
name: summit-release
description: Use when preparing or checking status on an actual App Store/TestFlight release of Summit — EAS build/submit, App Store Connect processing, store metadata (screenshots, privacy answers, copy), and the TestFlight tester loop. Use when Dane asks "are we ready to ship," "let's submit a build," "what's left before we can release," or wants a release checklist rather than a one-off answer. This is the repeatable release process, not a one-time launch plan.
---

# Summit Release

Runs the actual ship sequence — this is the checklist you'll use every release, not just V1. Grounded in `eas.json` (production build profile, `ascAppId: 6792136519`), `docs/PROJECT_STATUS.md`'s "Release with evidence" section, and `docs/PUBLISHING_COPY.md`. Re-check those before relying on this skill's summary of them — release process details drift.

## Gate before starting: has it actually been tested?

Don't start a release checklist on an untested build. Confirm `summit-device-qa` has been run and its Tier 1 (automated) checks pass, and know which Tier 2 (physical-device) items are still open — those don't have to be fully green to submit to TestFlight (TestFlight *is* how some device testing happens), but they must be named, not silently assumed fine.

## The sequence

1. **Build.** `eas build` on the `production` profile (`autoIncrement: true` — version bumps itself). Confirm the build actually completes, not just starts.
2. **Submit.** `eas submit` targets App Store Connect app `6792136519` per `eas.json`. Confirm it was accepted for processing, not just that the command exited 0.
3. **Track processing.** App Store Connect / TestFlight processing takes real external time — this is the "external/uncontrollable" bucket from `summit-cto`'s timeline framing, not something to promise a time on. Check status rather than assume.
4. **Store metadata.** Screenshots must show the real conversation surface, not marketing mockups (same rule `summit-distribution` enforces for ASO). Privacy answers need to match what the app actually does — check against `tech-context.md` in `summit-cto` (Keychain-only credential storage, content-free push, etc.) rather than guessing generic answers. Copy comes from `summit-launch-copy` — don't originate new claims here.
5. **TestFlight tester loop.** Once processed, testers come from `summit-tester-ops`; feedback triage also routes there.
6. **Evidence.** Every claim used in this release's public copy must trace to `summit-release-evidence`'s proven set — if something's still "implemented but unproven," that's a blocker for using it in copy, not a footnote.

## When something's blocked

- Build/submit failing for a technical reason (signing, credentials, native module issue) → hand to `summit-cto`.
- Store copy, positioning, or brand fit in question → hand to `summit-launch-copy` / `summit-cbo`.
- Whether it's ready to go out at all (graduation gate, timing) → that's `summit-growth-command`'s call, not this skill's — this skill executes the release, it doesn't decide whether to.

## Output

Return a checklist status: step → done / in progress / blocked → what's blocking it and who owns unblocking it (Dane, an external gate, or another skill) → the single next action.
