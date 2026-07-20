# Message Output Improvement Plan

_Status: next UX track after background continuity. Last reviewed: 2026-07-19._

Summit's output goal is not more chat decoration; it is making long, technical agent work easy to
follow and act on from a phone. The agent response should stream smoothly, settle into a stable
document, and preserve useful work even when transport or tool execution fails.

## Now

- Preserve partial generated text before a muted terminal error instead of replacing it.
- Render connector-replayed replies through the same settled markdown/document pipeline as live
  replies, so background completion does not produce a lower-quality message.
- Keep one stable message ID from connector completion through SQLite recovery to prevent duplicate
  output after reconnect.

## Next beta slice

1. Add fixture-driven parity tests for streamed versus settled headings, nested lists, tables,
   fenced code, links, and long unbroken strings.
2. Make tool progress a compact inline activity trail that collapses when the final answer settles;
   approvals remain prominent action cards.
3. Improve long-output navigation: copy a code block, copy a section/all, and jump back to the
   latest output without forcing auto-scroll while the user is reading.
4. Give failed replies a clear Retry action that resends from the saved user turn without adding a
   second duplicate user message.

## Later

- Agent-authored structured cards through a small, versioned JSON block schema.
- Export/share completed markdown documents. This is output handling, not Hermes file upload.
- Per-framework richer output only behind advertised capabilities; the shared chat model remains
  framework-agnostic.

Typing indicators, reactions, read receipts, social message actions, and decorative bubbles remain
out of scope. They do not improve the operator flow.
