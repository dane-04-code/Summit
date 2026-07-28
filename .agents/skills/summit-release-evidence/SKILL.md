---
name: summit-release-evidence
description: Audit Summit capabilities, launch claims, demos, screenshots, and release readiness against real tests. Use before recruiting beta testers, publishing marketing, submitting a build, or deciding whether to widen a Summit launch.
---

# Summit Release Evidence

Read `AGENTS.md`, `docs/GO_TO_MARKET_PLAN.md`, and the relevant product/docs artifacts. Treat a source-code implementation as different from a release-build, real-device proof.

## Evidence ledger

For every proposed claim, record one of: **proven on release build**, **implemented but unproven**, **not shipped**, or **unknown**. Include the supporting artifact/test and the exact public-safe wording.

## Release gates

Require evidence for:

- Hermes plugin/connector pairing on a real iPhone.
- Streaming plus safe activity with a settled final-answer replacement.
- Background or restart recovery producing exactly one settled reply in the intended thread.
- Eligible privacy-safe notification delivery and correct tap routing.
- Current installation/pairing docs and all public copy matching the proven set.

Block widening on unresolved P0/P1 privacy, pairing, recovery, or notification defects. Never turn absent evidence into a claim.

## Output

Return a compact table: claim, status, proof, safe wording, owner/next test. Separate blockers from polish.
