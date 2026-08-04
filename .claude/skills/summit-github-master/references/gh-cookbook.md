# gh cookbook for Summit repos

Commands that work with Dane's current auth (`dane-04-code`, scopes `gist read:org repo`).
Windows note: these are written for the Bash tool. In PowerShell, use `if ($?) { }`
instead of `&&` and here-strings for multi-line bodies.

Throughout, `R=SummitAI-app/Summit-Hermes`.

## Reading a repo without cloning

```bash
R=SummitAI-app/Summit-Hermes

# Metadata that drives the presentation checklist
gh repo view $R --json name,description,homepageUrl,repositoryTopics,visibility,licenseInfo,stargazerCount

# Root listing
gh api repos/$R/contents --jq '.[]|"\(.type) \(.name)"'

# Any file, decoded
gh api repos/$R/contents/CHANGELOG.md --jq '.content' | base64 -d

# The rendered README (whatever GitHub considers the readme)
gh api repos/$R/readme --jq '.content' | base64 -d
```

## Setting repo presentation metadata

```bash
gh repo edit $R \
  --description "Native Hermes platform plugin that connects a self-hosted Hermes agent to the Summit mobile app." \
  --homepage "https://summitapp.dev" \
  --add-topic hermes --add-topic hermes-plugin --add-topic ai-agent \
  --add-topic mobile --add-topic python --add-topic websocket
```

`gh repo edit` also takes `--enable-issues`, `--enable-wiki=false`, and
`--visibility public --accept-visibility-change-consequences`. Going public is
Dane's call — never run the visibility flag on your own initiative.

**Not settable via gh/API:** the social preview image. That is Settings → General →
Social preview → Upload an image (1280×640 PNG). Hand Dane those steps.

## Editing a file without a local clone

Cleanest path is a clone into the scratchpad, since it gives normal diffs and review:

```bash
SCRATCH="$TMPDIR/summit-hermes"   # or the session scratchpad directory
gh repo clone $R "$SCRATCH" -- --depth 1
# edit files with Read/Edit
cd "$SCRATCH" && git add -A && git commit -m "docs: ..." && git push
```

For a one-line metadata fix, the contents API works, but it needs the current blob SHA
and base64 content, and it bypasses review — prefer the clone.

## Cutting a release

```bash
# Draft first so Dane can read it before watchers are notified
gh release create v0.1.0 -R $R \
  --title "Summit for Hermes 0.1.0" \
  --notes-file notes.md \
  --draft

# Alpha / pre-1.0 builds
gh release create v0.1.0 -R $R --notes-file notes.md --prerelease

# Publish a draft after review
gh release edit v0.1.0 -R $R --draft=false

# Attach a build artifact
gh release upload v0.1.0 dist/summit_hermes-0.1.0-py3-none-any.whl -R $R
```

Write `notes.md` into the scratchpad, not the repo — the CHANGELOG is the in-repo record;
release notes are the announcement.

`gh release create --generate-notes` produces a raw commit list. It is a starting point
for recall, never the final body — it reads like a git log, which is exactly the
engineering-diff voice the README rules warn against.

## Checking CI before claiming the badge is green

```bash
gh run list -R $R --limit 5
gh run view <run-id> -R $R --log-failed
```

A CI badge pointing at a workflow that hasn't run in months is worse than no badge.

## Comparing what's in the repo to what shipped

```bash
# Commits since the last tag, to find undocumented changes
gh api repos/$R/compare/v0.1.0...main --jq '.commits[].commit.message' | head -50
```

Use this before writing a CHANGELOG entry so nothing user-visible gets missed —
then translate each one into user-facing language rather than pasting the subject lines.
