# Fenced markdown → collapsed file card

**Date:** 2026-07-05
**Status:** Approved

## Problem

When the agent shares an `.md` file, it pastes the contents into its reply text
(Hermes has no file transfer — this is the only way). The app's post-stream
settle step (`settleBlocks` in `src/ui/chat/streamReducer.ts`) already detects
one shape of this — raw pasted text with YAML front matter or an early H1, over
1,500 chars — and renders it as the collapsed `MdFileCard` → `MdReader` flow.

But agents commonly wrap file contents in a fenced code block
(```` ```markdown ````/```` ```md ````). That path renders as a numbered code
block, not the file card. Same file, two presentations, depending on a
formatting whim of the agent.

## Design

All changes live in `settleBlocks` (pure, unit-tested). No UI changes — the
card, reader, copy and download already work.

1. **Fenced markdown becomes a file card.** After a reply settles, extract any
   ```` ```markdown ```` / ```` ```md ```` fenced block into a
   `{ kind: 'file' }` block. Text before/after the fence stays as normal
   `markdown` blocks. Multiple fences → multiple cards, in order.
2. **Small floor, no big-file threshold.** The fence label is an explicit
   signal, so the 1,500-char rule does not apply. A floor of ~6 lines keeps
   tiny inline markdown *examples* from being hidden behind a card.
3. **Filename resolution**, in order: a `something.md` name mentioned in the
   text immediately before the fence (e.g. "Here's `notes.md`:"), else the
   document's own H1 (`# Trip Plan` → `Trip Plan.md`), else `document.md`.
4. **Whole-reply heuristic unchanged.** The existing raw-paste detection
   (front matter / early H1 + 1,500 chars) stays as-is; it guards against
   collapsing ordinary long replies that merely start with a heading.

## Out of scope

- Fences with other language tags (```` ```python ```` etc.) — still code blocks.
- Collapsing during streaming (doc renders inline until the stream settles —
  existing behaviour, unchanged).
- Any server/connector/protocol change.

## Testing

Unit tests on `settleBlocks` (existing test surface): fenced doc → file block;
surrounding prose preserved; filename from preceding text / H1 / fallback;
under-floor fence stays a code block; non-md fences untouched; existing
raw-paste cases still pass.
