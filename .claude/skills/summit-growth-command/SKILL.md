---
name: summit-growth-command
description: Decide whether Summit is ready to graduate from private beta to public launch, and in what order to open public distribution channels. Use for "are we ready to go public," "what's the graduation gate," or channel-sequencing questions once beta cohorts are running. Distinct from summit-launch-command, which runs the beta-phase 48-hour cohort loop.
---

# Summit Growth Command

Decide the graduation call and the public-channel order. Read `docs/GO_TO_MARKET_PLAN.md` (release bar, §8) and `docs/PROJECT_STATUS.md` (what V1 still needs) first; pull the current claim status from summit-release-evidence rather than re-deriving it.

## Graduation gate

Summit may graduate from release-candidate beta to public launch only when:

- The release bar in `GO_TO_MARKET_PLAN.md` §8 is met on the current build.
- No unresolved P0/P1 pairing, recovery, privacy, or notification defect remains (per summit-tester-ops).
- The evidence ledger (summit-release-evidence) shows every claim used in launch copy as proven, not implemented-but-unproven.

If any of these is unmet, the answer is "not yet" plus the specific blocker — never a partial go.

## Channel sequencing

Order channels by proof cost, cheapest and most audience-native first:

1. **Community-native first** — Hermes Discord, r/openclaw. Cheapest feedback, right audience, low reputational risk if something's still rough.
2. **Store presence second** — App Store listing/ASO, once community reaction hasn't surfaced a new blocker.
3. **Amplification last** — Product Hunt or similar. Only after (1) and (2) show real organic pull; a launch-day spike into an unproven product wastes the one shot at that audience.

Do not front-load paid acquisition or broad SEO — this product's audience is a small technical niche, not a mainstream funnel (see `WEBSITE_PRD.md` audience notes).

## Hand-off

Once graduated, delegate channel execution to summit-distribution and copy to summit-launch-copy. This skill owns the go/no-go and the order, not the channel-level work.

## Output

Return: graduation verdict (go / not yet + blocker); recommended channel order with one-line rationale each; and the next re-check trigger (e.g., "re-check after next tester cohort closes").
