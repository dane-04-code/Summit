---
name: summit-community-research
description: Use when Dane wants to find and evaluate candidate Reddit/Discord/X communities for Summit beyond the two already known (r/openclaw, Hermes Discord) — "what other subreddits/servers should we target," discovery/scouting for launch channels, or building a shortlist to feed summit-community-engagement and summit-distribution. Read-only research — safe to run on a /loop cadence since it never posts or contacts anyone.
---

# Summit Community Research

Find where Summit's actual audience — technical self-hosters already running Hermes or OpenClaw — already congregates online, beyond the two channels already locked in (r/openclaw, Hermes Discord per `docs/GO_TO_MARKET_PLAN.md` and `summit-distribution`). Output is a shortlist for a human (Dane) or a downstream skill to act on. This skill never posts, joins, follows, or contacts anyone — it only looks and reports.

## Audience discipline (same bar as summit-distribution)

Reject anything built for the wrong audience — general AI-chat communities, broad "AI productivity" spaces, mainstream app-discovery channels. Every candidate must plausibly contain people who already run a self-hosted agent server or are actively evaluating one (Hermes, OpenClaw, Ollama/local-LLM self-hosting, home-lab/self-hosted-software communities where agent tooling comes up). If a community only fits on a stretch, say so — don't pad the list to look thorough.

## What to look for per candidate

- **Fit signal**: does self-hosted AI agent tooling, Hermes, OpenClaw, or adjacent (local LLMs, home-lab agent setups) come up there organically, not just theoretically?
- **Size and activity**: dead communities waste outreach; note approximate size/post frequency where discoverable.
- **Self-promo tolerance**: does the community have visible rules against promotion/spam? Note them — this directly determines whether `summit-community-engagement` can draft anything for it at all, or whether it's a listen-only channel.
- **Existing overlap**: any visible mention of Hermes, OpenClaw, or comparable tools (Scarf, etc.) already being discussed there.

## Method and honest limits

Use web search and public pages (Reddit search, public subreddit listings, public Discord server-listing sites, X search) for anything reachable that way. Be upfront about what this skill *can't* verify: content locked behind a Discord login, private servers, or anything requiring an account isn't checkable from here — flag those as "needs manual check" rather than guessing at what's inside. Never fabricate size/activity numbers — if a number can't be confirmed, say "not verifiable from public data" instead of estimating confidently.

If genuinely unsure whether a candidate fits Summit's audience or positioning, ask Dane rather than guessing — he'd rather answer a quick question than have a bad channel waste outreach effort.

## Loop-safe by design

This skill is read-only, so it's safe to run repeatedly (e.g. via the `/loop` skill on a daily or weekly cadence) to keep the candidate list fresh as new communities form or existing ones grow. Never let a loop iteration expand into drafting or sending outreach — that handoff is manual, to `summit-community-engagement`.

## Hand-off

- Reddit/Discord/DM candidates worth engaging → hand to **summit-community-engagement** for drafting (still human-reviewed before anything is sent).
- Channel-level decisions (should this become an official distribution channel) → hand to **summit-distribution** / **summit-growth-command**, which own sequencing and the graduation gate.
- This skill only ever recommends; it doesn't decide to open a channel or send anything.

## Output

Return a ranked shortlist. Per candidate: name/link, platform, fit rationale (one line), size/activity signal (or "not verifiable"), self-promo rule note, and recommended next step (engage via summit-community-engagement / listen-only for now / not a fit). Flag anything that needed a judgment call rather than being a clean fit.
