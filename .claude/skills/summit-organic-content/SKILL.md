---
name: summit-organic-content
description: Use when drafting or scheduling Summit content for X/Twitter via Buffer — content calendar, post drafts, or actual scheduling. Covers only the channel that can be safely automated; see summit-community-engagement for Reddit, Discord, and DM outreach.
---

# Summit Organic Content

Own X only — the one channel where automated scheduling doesn't damage trust. Read `docs/PUBLISHING_COPY.md`, `BRANDING.md`, and `product-brief.md` for voice and positioning.

## Precondition

Before scheduling anything, call Buffer's `list_channels` and confirm a Summit-owned X/Twitter channel exists in the target organization. If it doesn't (or the only channels present belong to another product), stop and tell the user to connect Summit's X account in Buffer first — do not schedule to the wrong channel or repurpose another product's slot.

## Claims discipline

Every claim in a post must trace to summit-release-evidence's proven set. Do not originate new capability claims here; request copy from summit-launch-copy or verify against the ledger directly.

## Workflow

1. Draft into Buffer as an idea (`create_idea`) before it's calendar-ready — keeps a queue separate from what's actually scheduled.
2. Schedule with `create_post` only once the claim check passes and the post reads as one person sharing progress, not a corporate feed.
3. Respect the account's plan limits (channel count, scheduled-post count) — check `get_account` before batch-scheduling.

## Output

Return the draft or scheduled post, the claim sources used, and the Buffer channel/time it targets.
