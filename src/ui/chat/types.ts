/**
 * Chat content model for the agent screen.
 *
 * Agent replies are modelled as an ordered list of typed blocks rather than a
 * raw markdown string — this lets the design's rich content (status table,
 * code block, tool chip) render as first-class, token-styled UI without a
 * markdown parser. Live (streamed) replies are just a single `text` block.
 */

export type RunState = 'running' | 'idle' | 'error';

/** Inline run-segment of a paragraph — plain text or an inline code chip. */
export type Span = { text: string; code?: boolean };

/** A row in the service-status table. */
export type ServiceRow = {
  service: string;
  state: RunState;
  statusLabel: string;
  p95: string;
};

/** One line of a code block; segments allow colouring (e.g. an `ERR` token). */
export type CodeSegment = { text: string; tone?: 'error' };
export type CodeLine = { segments: CodeSegment[] };

/**
 * A Markdown file the agent wrote, attached to a reply. Holds the raw source
 * (the copy / download payload, and what the reader and preview render from)
 * plus the meta the collapsed card shows. Real agent files flow through the
 * same shape — the seeded research doc is just one input.
 */
export type MarkdownFile = {
  /** File name including the `.md` extension. */
  name: string;
  /** Human size label shown in the card and reader header (e.g. "12 KB"). */
  sizeLabel: string;
  /** Line count shown in the collapsed card meta. */
  lineCount: number;
  /** Raw markdown source. */
  source: string;
};

export type AgentBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; spans: Span[]; tone?: 'default' | 'muted' | 'error' }
  /** Ephemeral live status. It is rendered during a turn and never persisted. */
  | { kind: 'activity'; label: string }
  | { kind: 'table'; rows: ServiceRow[] }
  | { kind: 'code'; lines: CodeLine[] }
  | { kind: 'chip'; state: RunState; label: string }
  | { kind: 'file'; file: MarkdownFile }
  // Raw markdown the agent emitted — rendered richly (formatting, tables,
  // code, math, task lists, …) by RichMarkdown. The real shape for Hermes /
  // OpenClaw replies; the typed blocks above stay for app-authored content.
  | { kind: 'markdown'; source: string };

/** A pending run-approval request: the run id to resolve, plus what to show. */
export type ApprovalRequest = { runId: string; title: string; command: string };

/**
 * What a message is answering. A *frozen snippet*, not a live pointer: the
 * preview is captured when Reply is tapped and never re-read, so an edited or
 * deleted original can't change what a sent reply appears to quote. The `id`
 * is kept anyway — it's what a later scroll-to-original would resolve.
 */
export type ReplyRef = {
  id: string;
  author: 'user' | 'agent';
  /** Short one-line snippet for the UI strip. Cosmetic — never sent. */
  preview: string;
};

export type Message =
  | { id: string; role: 'user'; text: string; replyTo?: ReplyRef }
  | { id: string; role: 'agent'; blocks: AgentBlock[]; replyTo?: ReplyRef }
  | ({ id: string; role: 'action' } & ApprovalRequest);

/** A conversation summary in the sidebar recents list. */
export type ChatSummary = {
  id: string;
  title: string;
  preview: string;
  time: string;
  /** Drives the leading status dot colour. */
  state: RunState;
};

/** A dated section of recents ("Today", "Yesterday", …). */
export type ChatGroup = { label: string; chats: ChatSummary[] };

/** Maps a run-state to its semantic dot colour token key. */
export const STATE_LABELS: Record<RunState, string> = {
  running: 'running',
  idle: 'idle',
  error: 'error',
};

/** Flatten a code block to a single copyable string. */
export function codeToText(lines: CodeLine[]): string {
  return lines.map((l) => l.segments.map((s) => s.text).join('')).join('\n');
}

/** Flatten agent blocks to plain copyable text. */
export function blocksToText(blocks: AgentBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case 'heading':
          return b.text;
        case 'text':
          return b.spans.map((s) => s.text).join('');
        case 'activity':
          return '';
        case 'table':
          return b.rows.map((r) => `${r.service}  ${r.statusLabel}  ${r.p95}`).join('\n');
        case 'code':
          return codeToText(b.lines);
        case 'chip':
          return b.label;
        case 'file':
          return b.file.source;
        case 'markdown':
          return b.source;
      }
    })
    .filter((t) => t.trim().length > 0)
    .join('\n\n');
}

/** Plain copyable text for any thread message (long-press copy). */
export function messageToText(message: Message): string {
  if (message.role === 'user') return message.text;
  if (message.role === 'action') return `${message.title}\n${message.command}`;
  return blocksToText(message.blocks);
}

// ── Reply helpers ───────────────────────────────────────────────────────────
// A reply produces two derived strings from the same target, and they are not
// interchangeable: a short one for the UI, and the full quoted body that is
// folded into what the agent actually receives.

/** Length of the cosmetic snippet in the reply strip. */
export const REPLY_PREVIEW_CHARS = 100;

/**
 * Ceiling on the quoted original folded into the outbound message. Replying to
 * a long agent dump must not dominate the next turn's context window.
 */
export const QUOTED_CONTEXT_CHARS = 4000;

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/** Collapse a message to the single line shown in a reply strip. */
export function replyPreview(message: Message, maxChars = REPLY_PREVIEW_CHARS): string {
  return truncate(messageToText(message).replace(/\s+/g, ' ').trim(), maxChars);
}

/** Freeze a reply target into the ref stored on the outgoing message. */
export function replyRefFor(message: Message): ReplyRef | null {
  if (message.role === 'action') return null;
  return { id: message.id, author: message.role, preview: replyPreview(message) };
}

/**
 * The target message as a markdown blockquote, capped, for folding into the
 * string handed to the adapter. This is the whole point of the feature: the
 * referenced content travels with the new turn, so the agent sees it even when
 * its own session memory has rolled over. Empty targets quote nothing.
 */
export function buildQuotedContext(target: Message, maxChars = QUOTED_CONTEXT_CHARS): string {
  const body = truncate(messageToText(target).trim(), maxChars);
  if (!body) return '';
  return body
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

/** The outbound string for a reply: the quoted original, then what was typed. */
export function withQuotedContext(
  target: Message | null,
  typed: string,
  maxChars = QUOTED_CONTEXT_CHARS,
): string {
  const quoted = target ? buildQuotedContext(target, maxChars) : '';
  return quoted ? `${quoted}\n\n${typed}` : typed;
}

// ── Markdown document helpers ───────────────────────────────────────────────
// Pure string utilities shared by the file card (preview) and the reader
// (front-matter card). Kept here, parser-free, so they're unit-testable.

/** A parsed `key: value` line from a document's YAML front matter. */
export type FrontMatterEntry = { key: string; value: string };

/**
 * Split a leading YAML front-matter block (`--- … ---`) off a markdown source.
 * Returns the inner front-matter text (without the fences) and the remaining
 * document body. When there's no front matter, `frontMatter` is null.
 */
export function splitFrontMatter(source: string): {
  frontMatter: string | null;
  body: string;
} {
  const match = source.match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return { frontMatter: null, body: source };
  // Drop the blank line(s) between the closing fence and the first content.
  const body = source.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, '');
  return { frontMatter: match[1], body };
}

/** Parse front-matter `key: value` lines (shallow — no nested YAML). */
export function parseFrontMatter(frontMatter: string): FrontMatterEntry[] {
  return frontMatter
    .split(/\r?\n/)
    .map((line): FrontMatterEntry | null => {
      const i = line.indexOf(':');
      if (i === -1) return null;
      return { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
    })
    .filter((e): e is FrontMatterEntry => e !== null && e.key.length > 0);
}

/** Does a front-matter value look like an ISO date? (Drives its highlight colour.) */
export function isDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value);
}

/**
 * The first `count` non-blank lines of a markdown source, with any leading
 * front matter stripped — drives the collapsed file card's mono preview.
 */
export function mdPreviewLines(source: string, count = 2): string[] {
  const { body } = splitFrontMatter(source);
  return body
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
    .slice(0, count);
}
