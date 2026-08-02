# Stage 1 Prep — Research (Swipe File)

Prep status for Stage 1 of `docs/launch-advice/x-trending-guide.md`, applied to Summit's actual
niche: technical self-hosters running Hermes/OpenClaw agents.

## What's ready now

- **Account list** — `scripts/x-swipe-file-accounts.json`. Categorized into direct competitors,
  core ecosystem, hosting/tooling, and recent launches. Confirmed real handles found via research
  2026-07-30:
  - `@openclaw` — official account; ran the June 2026 iOS/Android launch (1.5M+ views in hours,
    but landed at ~2.2 stars — buggy, hard to pair, unpolished). This is the single best case
    study available: huge reach *and* a concrete trust failure to contrast Summit against.
  - `@steipete` — Peter Steinberger, OpenClaw's creator/steward (now at OpenAI); highest-reach
    individual voice in the niche.
  - `@NousResearch` — builds Hermes Agent; posts feature launches that reliably get niche engagement.
  - **Clawket** (`p697/clawket` on GitHub, live on the App Store) — an open-source mobile client for
    *both* OpenClaw and Hermes. This is Summit's closest direct competitor and its handle still
    needs confirming — flagged in the JSON as `clawket_ai` (unverified guess, not confirmed).
  - Several hosting/tooling players (OneClaw, AgentClaw, ClawHub, ClawTank) are identified by name
    but their exact `@handles` still need confirming — marked `needs_handle` in the JSON.
- **Fetch + rank script** — `scripts/x-swipe-file.mjs`. Pulls each account's recent posts via
  twitterapi.io, keeps only posts beating that account's own average views, ranks them, and writes
  `docs/launch-advice/swipe-file.md` with a "why it worked" slot per post to fill in by hand.

## What's blocking a run

**No X data API key yet.** Sign up at twitterapi.io (no approval process, key issued immediately,
priced per call — a few dollars covers this whole pass), then run:

```
TWITTERAPI_KEY=your-key node scripts/x-swipe-file.mjs
```

This does not need to go in `.env` — it's a one-off research pull, not app runtime config, so
passing it inline (or export it in your shell for the session) is enough.

## Before running

1. Confirm Clawket's real X handle (or drop it from the list if it doesn't post there) — it's the
   most important entry to get right since it's a direct competitor, not just an adjacent tool.
2. Fill in `needs_handle` entries for OneClaw/AgentClaw/ClawHub/ClawTank, or delete any that turn
   out not to have an active X presence.
3. Optionally add more recent-launch and mid-size-creator accounts to push past ~8 confirmed
   handles toward the 50+ the guide calls for — the script reads whatever is in the JSON, no code
   change needed to add more.

## After running

The output (`docs/launch-advice/swipe-file.md`) will have real posts and numbers but empty "why it
worked" notes — that analysis pass (hook type, format, claim structure) is the part worth doing
together rather than automating, since it's the actual point of Stage 1: understanding *why*
things worked, not just collecting them.
