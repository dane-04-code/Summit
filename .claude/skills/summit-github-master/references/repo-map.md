# Summit repo map

Inventory as verified 2026-08-04. Re-check with `gh repo list` and
`gh api user/repos --jq '.[].full_name'` if anything looks stale — the org repos
do not show up in a plain `gh repo list`.

## SummitAI-app/Summit-Hermes — the plugin

The Hermes platform plugin. **This is the repo that matters most for presentation**;
it is what a self-hosted Hermes user installs from and reads before trusting us with
a process on their machine.

- Private today, MIT licensed, 1 star.
- Python. `plugin.yaml` declares `name: summit`, `kind: platform`, `version: 0.1.0`.
- Structure: `summit_hermes/`, `tests/`, `docs/`, `.github/workflows/ci.yml`,
  `.github/CODEOWNERS`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`.
- Docs: `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/DEVELOPMENT_WORKFLOW.md`.
- Install line users run: `hermes plugins install SummitAI-app/Summit-Hermes`.
- README already has CI + license badges and a good "How it works" diagram.

Known gaps as of this writing (good first tasks when asked to tidy it up):

- No repo description, no topics, no homepage URL.
- No GitHub Releases at all; CHANGELOG says `0.1.0 - Unreleased`.
- No screenshots or images anywhere — only the ASCII diagram.
- No social preview image.

## SummitAI-app/Summit — org home for the app

Private and **empty**. Intended as the org-owned home for the app repo. Until content
lands here, don't link to it from anywhere public — an empty repo behind a link is
worse than no link.

## dane-04-code/Summit — the app repo in use

Public. Alias `dane-04-code/agentchat` resolves to the same repo, and it is the `origin`
remote of the local `C:\Agent Messaging` checkout. Has a substantial README describing
Summit's position, V1 path, and doc index, plus a `connector-latest` pre-release from
2026-06-29 ("Connector (latest build)").

Note the split: the app README points at `docs/` inside that repo; the plugin README
points at `docs/` inside `Summit-Hermes`. Keep the two from contradicting each other
about plugin behavior — the plugin repo is the source of truth for plugin specifics,
and the app README already says so.

## dane-04-code/Summit-web — marketing site

Private, Next.js marketing site. Not a plugin repo; only relevant here as the target
of the `homepage` field on the other repos.

## Other repos under dane-04-code

`bitoleadgendash`, `Courselingo`, `Dropply`, `Fusefun`, `MyTradeLink`, `OvelaApp`,
`ovelawaitlist`, `PLONC`, `pmi`, `saveasub`. Unrelated to Summit. Leave them alone
unless Dane names one.

## Auth

`gh` is authenticated as `dane-04-code` (keyring, HTTPS) with scopes `gist`, `read:org`,
`repo`. That is enough to read and write both org repos. It is **not** enough for
org-level settings changes.
