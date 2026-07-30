---
name: summit-growth-analytics
description: Use when wiring up or reading marketing-funnel analytics (PostHog) for Summit — website visits, waitlist signups, TestFlight joins, channel attribution — or when summit-growth-command needs to know which channel (Reddit/Discord/X/DM) is actually producing paired agents.
---

# Summit Growth Analytics

Track the marketing funnel only, never in-app agent behavior. Read `STACK.md`'s Analytics section (explicit no-phone-home stance for the app) and `docs/GO_TO_MARKET_PLAN.md` before adding any event.

## The boundary

- PostHog receives website/business events only: page views, waitlist signups, TestFlight joins, and a server-side pairing-succeeded signal already known to the relay backend.
- It never receives mobile-app instrumentation, chat content, tool activity, or anything from the client. This is not a preference — it's the product's stated privacy promise. If a request would add client-side tracking, stop and flag the conflict with `STACK.md` instead of proceeding.

## Funnel and attribution

1. Tag acquisition at the source: every waitlist/TestFlight signup carries a channel value (`reddit`, `discord`, `x`, `dm`, `other`) captured from the referring link or form, not guessed after the fact.
2. Join that channel tag against the relay's existing pairing-succeeded signal to get real conversion, not just signup counts.
3. Report as a channel table: signups → TestFlight joins → paired agents → conversion rate, per channel.

## Output

Return the channel-attribution table plus one line on which channel is currently the best-converting, for summit-growth-command to use in channel sequencing. Flag any gap where a channel exists but isn't tagged yet.
