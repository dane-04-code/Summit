---
name: summit-app-store
description: Owns Summit's App Store Connect listing — keywords/ASO, app name, subtitle, promotional text, description, what's new, category, screenshots and captions, app previews, privacy nutrition labels, age rating, review notes, localization, and post-launch listing iteration (Product Page Optimization, custom product pages). Use whenever Dane mentions the App Store listing, ASO, keywords, store screenshots, subtitle/title, "what's new" release notes for the store, App Store rejection or metadata review, or asks how Summit gets found in search. Works with summit-cbo for brand fit and summit-release-evidence for claim truth.
---

# Summit App Store Listing

Owns everything a user sees on Summit's App Store product page, and everything that decides whether
they see it at all. App Store Connect app ID `6792136519`, bundle `com.dane04code.agentmessenger`
(see `eas.json`, `app.json`).

**Read `listing-context.md` before touching any field** — it holds the field character budgets, the
current listing state, Summit's seed keyword pool, and the banned-terms list.

## The two jobs, kept separate

1. **Discovery (ASO)** — the keyword field, app name, subtitle, and category. This is a ranking
   problem: character budget is scarce and every word must earn its place.
2. **Conversion** — screenshots, promotional text, description, previews. This is a persuasion
   problem: the first two screenshots and the subtitle do ~all the work; the description is read by
   almost nobody before install.

Don't optimize one at the expense of the other, and don't let "it reads nicely" win a keyword-field
argument or "it ranks well" win a screenshot argument.

## Where an external ASO skill fits

Dane is importing a dedicated ASO skill for keyword research methodology. When one is available,
**use it for method** — keyword discovery, volume/difficulty scoring, competitor teardown, ranking
strategy — and use this skill for **Summit-specific inputs and final calls**: audience, seed terms,
banned terms, claim limits, and what actually goes in the field. If its recommendations conflict with
the audience or banned-terms rules below, this skill wins on the what, that skill wins on the how.

## Audience discipline — read this, it has moved

The target is **casual-to-semi-technical Hermes/OpenClaw users already running a personal assistant
agent through a raw Telegram bridge** — not the hardcore self-hosting infra crowd. `summit-cbo`'s
`brand-context.md` resolved this on 2026-07-30 and it supersedes the older "technical self-hosters"
framing still sitting in `docs/PUBLISHING_COPY.md` (dated 2026-07-04).

This changes keyword strategy concretely:

- Keep the platform-intent terms that qualify the right user: `hermes`, `openclaw`, `self hosted`,
  `agent`.
- Reject broad consumer terms Summit cannot rank for and does not want: `ai chat`, `chatbot`,
  `ai assistant`, `gpt`. Losing a head term you'd place 200th for costs nothing; ranking top-3 for
  `hermes mobile` is the whole game.
- Copy can be warmer and less jargon-first than the old framing implied — a subtitle doesn't have to
  prove technical credentials to someone who already installed Hermes.

## Non-negotiables

- **Every claim traces to `summit-release-evidence`'s proven set.** The store listing is the single
  highest-stakes claim surface Summit has — Apple review reads it, and users hold you to it. Do not
  originate claims here. Anything "implemented but unproven" is blocked from the listing, not
  footnoted.
- **Honor the avoid-list** in `docs/PUBLISHING_COPY.md` ("Avoid saying") and `listing-context.md`.
  End-to-end encryption, file upload, OpenClaw v1 parity, and "secure by design" are not sayable.
- **Screenshots are real app screens.** No marketing mockups, no invented conversations that show
  behavior the app doesn't produce. Same rule `summit-distribution` and `summit-release` enforce.
- **Privacy nutrition labels must match actual behavior**, not a generic answer set — check against
  `summit-cto`'s `tech-context.md` (Keychain-only credential storage, content-free push) before
  answering. A wrong label is a compliance problem, not a copy problem.
- **Verify field limits against App Store Connect** before finalizing. `listing-context.md` carries a
  working baseline, but Apple moves these; treat the doc as the starting point and the live form as
  the authority.
- **Metadata-only changes ship without a build.** Keywords, subtitle, description, and screenshots
  can be updated on the live listing independent of a release — so listing iteration is not gated on
  `summit-release`. Say so rather than parking a keyword fix behind a build.

## Handoffs

| Question | Owner |
|---|---|
| Does this sound like Summit? Voice/brand fit | `summit-cbo` — get the brief before drafting, the check after |
| Is this claim proven? | `summit-release-evidence` |
| Website, community, demo, X copy | `summit-launch-copy` (it defers to this skill on store fields; this skill defers to it everywhere else) |
| Should the listing go live / which channel opens when | `summit-growth-command` |
| Build, submit, App Store Connect processing | `summit-release` |
| Product Hunt, Reddit, Discord positioning | `summit-distribution` |
| Install/conversion data, attribution | `summit-growth-analytics` |
| Privacy-label facts, rejection caused by app behavior | `summit-cto` |

When drafting listing copy, get the brand-fit brief from `summit-cbo` **first** so the draft isn't
written blind, and run the finished fields back through its brand checklist before they're entered.

## Working the listing

1. **Establish the ask.** Which field(s), and is this a first fill or an iteration on live copy?
2. **Pull current state** from `listing-context.md` and `docs/PUBLISHING_COPY.md`. Flag drift between
   them — they fork easily, and `PUBLISHING_COPY.md` is stale on audience.
3. **Check the claim ledger** for anything the draft would assert.
4. **Draft to the character budget**, counting characters explicitly. For the keyword field: comma-
   separated, **no spaces after commas** (a space costs a character), no word repeated from the app
   name or subtitle (Apple already indexes those), no plurals of a word already present, no category
   name.
5. **Brand check** via `summit-cbo`.
6. **Report** in the output shape below, and update `docs/PUBLISHING_COPY.md` so the repo's copy of
   record doesn't fork from what's live.

## Post-launch iteration

Listing work doesn't end at submission. Own these on an ongoing basis:

- **Keyword rotation** — re-check rankings after each release; swap terms that never placed.
- **Product Page Optimization** — Apple's native A/B test for icon, screenshots, and preview. Test
  one variable at a time; screenshot order first, it moves conversion most.
- **Custom product pages** — a distinct page per inbound channel (r/openclaw vs. Hermes Discord vs.
  Product Hunt), so the first screenshot matches what that audience was just told. Coordinate the
  channel list with `summit-distribution`.
- **What's new** — each release gets real release notes, not "bug fixes and improvements." Source
  from the release's actual changes; `summit-github-master` owns the developer-facing changelog, this
  skill owns the user-facing one, and they should not contradict each other.

## Output

Per field worked, return: **field → the copy → character count vs. budget → claims used and their
evidence source → what was deliberately left out and why**. Plus any drift found between
`listing-context.md`, `docs/PUBLISHING_COPY.md`, and the live listing, and the single next action.

If a request would require an unproven claim, a banned term, or a keyword strategy aimed at the wrong
audience, say so plainly and offer the nearest version that's defensible — don't quietly soften it.

## Resources

- `listing-context.md` — field budgets, current listing state, seed keyword pool, banned terms,
  screenshot spec (read first, every time)
