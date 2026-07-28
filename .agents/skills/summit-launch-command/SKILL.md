---
name: summit-launch-command
description: Coordinate Summit's private beta or public launch when prioritizing launch work, assigning launch-agent roles, reviewing readiness, or preparing a time-boxed launch plan. Keeps work tied to the Hermes-first mobile-cockpit promise and proven evidence.
---

# Summit Launch Command

Run Summit launch work as four small lanes: release evidence, tester operations, launch copy, and command. Read `docs/GO_TO_MARKET_PLAN.md` first; use `product-brief.md` for product scope.

## Operating loop

1. Establish the current launch phase: friendly alpha, private beta, release-candidate beta, or public launch.
2. Ask the evidence lane for only verified capability and device-test status.
3. Ask tester operations for cohort progress, repeated friction, and support capacity.
4. Let copy use only verified claims and the selected phase.
5. Publish one 48-hour priority list with an owner, acceptance condition, and explicit hold/widen decision.

## Non-negotiables

- Launch Hermes first. Do not imply live OpenClaw support, E2E encryption, uploads, arbitrary UI, native approvals, or Cron parity unless release-proven.
- Treat pairing, exact-once settled-reply recovery, and intended notification routing as release gates.
- Fix repeated P0/P1 core-loop failures before widening recruitment.
- Prefer a short device-proof demo over feature-list marketing.

## Required output

Return: current phase; gates passed/blocked; the three highest-impact next actions; role assignments; and the decision date. Keep a fact/risk distinction.
