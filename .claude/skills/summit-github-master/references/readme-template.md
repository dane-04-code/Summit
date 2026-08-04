# Plugin README skeleton

Use this when creating a new Summit plugin/connector repo, or when an existing README
has drifted into disorder. If a README already reads well, improve it in place —
reorganizing a good document to match a template is churn.

The ordering below is not arbitrary. A self-hoster reads in a fixed sequence:
*what is this → do I trust it → how do I install it → how do I configure it → where do
I go when it breaks.* Any section that answers a question the reader hasn't asked yet
gets skipped, and skipped sections train the reader to skim past the important ones.

```markdown
# <Product> for <Host>

[![CI](https://github.com/ORG/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/ORG/REPO/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<Two or three sentences: what this is, what it connects, and the one thing it
makes possible that wasn't possible before. Written so it stands alone if
someone pastes just this paragraph into a chat.>

<One sentence on what it deliberately does *not* do. Scope discipline reads as
competence, and it pre-empts the first suspicious question.>

> Status: <alpha/beta/stable>. <What is implemented.> <What is not in this
> release.>

## How it works

```text
<ASCII flow diagram: the boxes and the direction of the arrows>
```

- <Bullet per trust-relevant mechanic: what connects outward, what secret goes
  where, what is persisted and by whom.>

See [Architecture](docs/ARCHITECTURE.md) and [Threat model](docs/THREAT_MODEL.md).

## Install

```bash
<the single command>
```

<Any required post-install step, numbered, with the exact expected output so the
reader can tell whether it worked.>

## Configuration

<One sentence stating whether any config is required at all. If none is, say so
first — it is the best news in the document.>

| Variable | Default | Purpose |
|---|---|---|
| `VAR` | `default` | <what it changes> |

<Subsections for optional feature areas, each opening with the fact that it is
optional.>

## Screenshots

<img src="docs/assets/<name>.png" width="320" alt="<real description>">

## Troubleshooting

<Symptom → cause → fix. Only entries someone has actually hit.>

## Development

```bash
<test and lint commands>
```

See [Development workflow](docs/DEVELOPMENT_WORKFLOW.md).

## License

MIT — see [LICENSE](LICENSE).
```

## Section notes

**Title** — name it after the relationship, not the product alone. "Summit for Hermes"
tells a Hermes user this is for them; "Summit Plugin" makes them work it out.

**Badges** — CI and license only, until there is a package to version-badge. Each badge
must link somewhere useful.

**Status blockquote** — the single highest-value line in an alpha README. It converts
"this is broken" into "this is alpha, as documented."

**How it works before Install** — a self-hoster is being asked to run our process on
their machine. Trust has to be established before the install command, or the install
command reads as presumptuous.

**Configuration table** — must agree exactly with `plugin.yaml`'s `optional_env`.
Check both whenever either changes.

**Troubleshooting** — grow it from real support questions. An invented troubleshooting
section is filler; a real one is the most-linked part of the README.

## Things to leave out

- A table of contents. GitHub renders one from the heading icon; a hand-maintained one
  goes stale.
- A "Features" bullet list. It duplicates "How it works" with less information.
- Roadmap promises. They date instantly and turn into a debt ledger in public.
- Contributor/star/fork badge walls, "Made with", and emoji section headers.
