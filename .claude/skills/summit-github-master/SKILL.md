---
name: summit-github-master
description: Owns how Summit's GitHub repos look and read to outside developers — READMEs, release notes and CHANGELOG entries, GitHub Releases, badges, screenshots and diagrams, repo descriptions, topics, and docs structure across SummitAI-app/Summit-Hermes, SummitAI-app/Summit, and dane-04-code/Summit. Use this skill whenever Dane mentions the GitHub, a README, release notes, a changelog, a version bump, badges, "make the repo look good/presentable", repo images or screenshots, or says a feature just shipped and the repo should reflect it — and also proactively after any plugin-facing change lands, since the repo is the plugin's storefront for self-hosters and drifted docs cost installs. Covers the Hermes plugin repo and any future Summit plugin/connector repo.
---

# Summit GitHub master

Summit's repos are not internal scratch space. `Summit-Hermes` is how a self-hosted
Hermes user decides whether to run our code on their own machine, and the README is
the entire sales pitch, install guide, and trust argument in one file. Treat every
change to these repos as a change to a public product surface.

## What lives where

Read `references/repo-map.md` for the full inventory before touching anything —
it records which repo is canonical, which are mirrors, and what state each is in.
The short version:

- **`SummitAI-app/Summit-Hermes`** — the Hermes platform plugin (Python, `plugin.yaml`,
  MIT). This is the repo outsiders install from. It gets the most care.
- **`SummitAI-app/Summit`** — org home for the app. Currently empty.
- **`dane-04-code/Summit`** — the app repo people actually see today (the local
  `C:\Agent Messaging` checkout pushes here as `origin`/`agentchat`).
- **`dane-04-code/Summit-web`** — marketing site, private.

Most repos are still private. When Dane says "for when people are viewing it," he is
describing the state they are about to be in, so write for a stranger, but say plainly
if something is blocked on the repo going public.

## House voice

The existing `Summit-Hermes` README already establishes the voice, and consistency is
worth more than any individual improvement. Match it rather than importing generic
open-source README conventions:

- Calm, declarative, present tense. "The plugin opens an outbound `wss://` connection."
  Not "Summit magically connects!"
- No emoji, no exclamation marks, no "🚀 Features" headers, no "Made with ❤️".
- Hard-wrap prose at ~80 columns. The repo is read in editors as well as browsers.
- Lead with what the thing *is* and what it does for the reader, then how it works,
  then install, then configuration, then the pointers to deep docs.
- Say what is *not* built. The current README's "Rich attachments and native approval
  cards are not part of the first release" is doing real work — it sets expectations
  so an alpha user isn't disappointed, and it signals we know our own scope.
- Tables for configuration variables. Fenced `text` blocks for architecture diagrams.
  A `> Status:` blockquote near the top for maturity.

`references/readme-template.md` has the full section skeleton with the reasoning for
each part. Use it when creating a new plugin repo or restructuring an existing README;
don't rebuild an existing README to match it if the existing one already reads well.

## Truthfulness is the hard constraint

Summit's whole positioning to technical self-hosters depends on the README being
accurate about what works. A README claiming device-verified push when push has never
run on a real device is worse than an empty README — it gets found out on install day.

Before writing any capability claim:

- Check the code, the CHANGELOG, and `docs/PROJECT_STATUS.md` in the app repo.
- If a claim can't be traced to something that has actually run, either drop it or
  mark it explicitly (`planned`, `alpha`, `not yet verified on device`).
- Screenshots must come from real builds. Never assemble a mockup and present it as
  the app.
- When Dane asks for a claim that outruns the evidence, say so in a sentence, then
  write the strongest *true* version and show it to him.

The `summit-release-evidence` skill is the deeper audit if a claim is contested.

## Recording a shipped change

This is the routine job: something landed, make the repo reflect it. Do all four
layers, in this order, because each one feeds the next.

1. **CHANGELOG.md** — append a bullet under the current unreleased version heading.
   Match the existing style: one line, past tense or noun phrase, describing user-visible
   behavior, not the diff. "Live tool activity streamed to Summit while a turn is
   running, without exposing tool names or arguments" — not "refactored activity
   handler in relay.py."
2. **README.md** — only if the change alters what a user installs, configures, or can
   expect. A new env var means a new table row. A new capability means the status
   blockquote or the "How it works" bullets may now be stale. Most internal changes
   touch nothing here, and that's correct — resist padding the README.
3. **`plugin.yaml`** — bump `version` on a release, and add `optional_env` entries for
   any new configuration. This file and the README config table must never disagree;
   a mismatch here is a support ticket.
4. **GitHub Release** — cut one when a version is actually tagged, not for every merge.
   See "Release notes" below.

Verify by reading the rendered README on GitHub (`gh repo view <repo> --web`, or fetch
the raw file) rather than trusting the local file — relative image paths and HTML tags
behave differently once rendered.

## Release notes

The CHANGELOG is the durable engineering record; the GitHub Release is the reader-facing
announcement. They are not the same document and copying one into the other wastes both.

A release body should open with two or three sentences on what this version means for
someone running the plugin, then group the changes:

```markdown
Summit for Hermes 0.1.0 — first alpha release.

Text chat between a self-hosted Hermes agent and the Summit app now works
end to end: native sessions, streamed drafts, reconnect, and replies that
survive the phone being offline.

### Added
- Native Cron job controls: list, inspect, run, pause, and resume existing jobs.
- Live tool activity labels while a turn is running.

### Fixed
- Plugin loading and relay keepalive diagnostics on early Hermes hosts.

### Known limits
- Rich attachments and native approval cards are not in this release.

**Install:** `hermes plugins install SummitAI-app/Summit-Hermes`
```

The "Known limits" section is not optional for an alpha. It is the difference between
an honest release and a disappointing one.

Cut it with `gh release create` — see `references/gh-cookbook.md` for the exact
invocations, including how to attach assets and mark a pre-release.

## Images and diagrams

Images are the cheapest credibility a repo can buy, and Summit is a *visual* product —
a self-hoster deciding whether to install should be able to see the app.

- Store them in `docs/assets/`. Reference with relative paths (`docs/assets/pairing.png`)
  so they survive forks and work in private repos.
- Constrain width with HTML so a 3x phone screenshot doesn't blow out the page:
  `<img src="docs/assets/chat.png" width="320" alt="Summit chat view">`.
- Always write real `alt` text. It is read by screen readers and shown when the image
  fails to load.
- For anything with a background that would vanish in the other theme, ship both and
  switch with `<picture>` + `prefers-color-scheme` rather than picking one and hoping.
- Prefer a fenced `text` ASCII diagram over an image for architecture. It diffs, it
  never 404s, it renders in a terminal, and the existing README already uses one.
  Reach for a real image only when the thing is genuinely visual (the app UI).
- The repo's social preview image (what unfurls in Slack/X/Discord links) is a
  Settings-page upload, not something `gh` can set. If it's missing, say so and hand
  Dane the exact steps — don't quietly skip it.

Badges go immediately under the H1, and only ones that mean something: CI status,
license, and — once published — the install/version badge. A wall of shields.io badges
reads as noise, not rigor.

## Repo presentation checklist

Run this when asked to "make the GitHub look presentable," or before a repo goes public.
Check each item against the live repo with `gh`, don't assume:

- [ ] Repo **description** set (one line, says what it is, no marketing).
- [ ] **Topics** set — for the plugin: `hermes`, `hermes-plugin`, `ai-agent`,
      `mobile`, `python`, `websocket`.
- [ ] **Homepage** URL pointing at the Summit site.
- [ ] README opens with H1, badges, and a paragraph that stands alone.
- [ ] `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` present.
- [ ] CI badge is green, and actually points at a workflow that runs.
- [ ] Deep docs (`docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`) linked from the README,
      not orphaned.
- [ ] At least one real screenshot or diagram above the fold.
- [ ] Social preview image uploaded (manual, Settings → General).
- [ ] Latest release exists and its notes match the CHANGELOG.

Report the checklist back with what you fixed, what needs Dane (anything requiring the
web UI or a decision), and what you deliberately left alone.

## Working with `gh`

Dane's `gh` is authenticated as `dane-04-code` with `repo`, `read:org`, and `gist`
scopes, which covers the `SummitAI-app` org repos. `references/gh-cookbook.md` has the
commands for reading and editing repo metadata, creating releases, updating a file
without a local clone, and checking CI — reach for it rather than re-deriving the flags.

Two rules on writes:

- Editing a README or cutting a release is outward-facing. If the repo is public, or the
  release will notify watchers, show Dane the text first unless he's already told you to
  just push it.
- Never force-push, never rewrite tags, never delete a release. If something shipped
  wrong, add a corrected entry rather than erasing history — the CHANGELOG is a record.

## Related skills

- `summit-release` — the actual App Store/TestFlight release process. GitHub release
  notes should not contradict what that skill says is shipping.
- `summit-release-evidence` — use when a capability claim needs auditing before it goes
  in a README.
- `summit-launch-copy` — external marketing copy. The README is adjacent but more
  technical and more conservative; don't let launch language leak into it.
