/**
 * Fold a stream of normalized adapter events into the live agent turn. Pure and
 * synchronous so the accumulation logic is unit-tested without rendering or a
 * network. The chat screen holds a `LiveTurn` per in-flight reply and renders
 * `turnToBlocks(turn)` after each event. Persist the settled turn once `done`
 * (docs/AGENTS.md §7) — never the deltas.
 */

import type { StreamEvent } from '@/agents/adapters/types';
import type { AgentBlock, ApprovalRequest, MarkdownFile } from './types';
import { splitFrontMatter } from './types';

export type LiveTurn = {
  text: string;
  toolLabel: string | null;
  status: 'running' | 'idle' | 'error';
  error: string | null;
  done: boolean;
  /** Set when the run hit an approval gate; surfaced as an action card. */
  pendingApproval: ApprovalRequest | null;
};

export const initialTurn: LiveTurn = {
  text: '',
  toolLabel: null,
  status: 'running',
  error: null,
  done: false,
  pendingApproval: null,
};

export function reduceTurn(turn: LiveTurn, event: StreamEvent): LiveTurn {
  switch (event.type) {
    case 'delta':
      return { ...turn, text: turn.text + event.text };
    case 'tool': {
      if (event.label === turn.toolLabel) return turn;
      return { ...turn, toolLabel: event.label };
    }
    case 'approval':
      return {
        ...turn,
        pendingApproval: {
          runId: event.runId,
          title: event.title,
          command: event.command,
        },
      };
    case 'detached':
      return { ...turn, toolLabel: null, status: 'idle', done: true };
    case 'done':
      // Native Hermes can revise a draft after a tool boundary. Its terminal
      // content is authoritative, so never persist a superseded partial draft.
      return {
        ...turn,
        ...(event.content !== undefined ? { text: event.content } : {}),
        toolLabel: null,
        status: 'idle',
        done: true,
      };
    case 'error':
      return { ...turn, toolLabel: null, status: 'error', error: event.message, done: true };
    default:
      return turn;
  }
}

/** Minimum interval between streaming UI flushes — keeps long replies smooth. */
export const STREAM_FLUSH_MS = 60;

/**
 * Gate for streaming UI updates: terminal events always flush; otherwise
 * rate-limit so each SSE chunk doesn't force a full markdown re-render.
 */
export function shouldFlush(lastFlushAt: number, now: number, done: boolean): boolean {
  return done || now - lastFlushAt >= STREAM_FLUSH_MS;
}

/** Live reply text plus an ephemeral operational status when the agent is quiet. */
export function turnToBlocks(turn: LiveTurn): AgentBlock[] {
  const blocks: AgentBlock[] = turn.text ? [{ kind: 'markdown', source: turn.text }] : [];
  if (!turn.done && turn.toolLabel) {
    blocks.push({
      kind: 'activity',
      label: turn.toolLabel,
    });
  }
  return blocks.length > 0 ? blocks : [{ kind: 'markdown', source: '' }];
}

// ── Post-stream settling ─────────────────────────────────────────────────────

const DOCUMENT_MIN_CHARS = 1500;
// H1 at the start of a line, capturing the heading text
const H1_RE = /(?:^|\n)(#[ \t]+([^\n]+))/;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function buildFileBlock(name: string, source: string): AgentBlock {
  const file: MarkdownFile = {
    name,
    source,
    sizeLabel: formatBytes(source.length),
    lineCount: source.split('\n').length,
  };
  return { kind: 'file', file };
}

// A ```markdown / ```md fence is an explicit "here's a file" signal from the
// agent, so no length threshold applies — only a small floor so inline
// markdown *examples* aren't hidden behind a card.
const MD_FENCE_RE = /^```(?:markdown|md)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*\r?$/gim;
const FENCE_MIN_LINES = 6;
/** A bare `name.md` filename mentioned in prose (no spaces). */
const MD_NAME_RE = /[\w][\w.-]*\.md\b/gi;

function fenceFileName(preceding: string, content: string): string {
  const mentioned = preceding.match(MD_NAME_RE);
  if (mentioned?.length) return mentioned[mentioned.length - 1];
  const h1 = content.match(H1_RE)?.[2]?.trim();
  if (h1) return /\.\w{1,6}$/.test(h1) ? h1 : `${h1}.md`;
  return 'document.md';
}

/**
 * Extract ```markdown / ```md fenced documents into file blocks, keeping the
 * surrounding text as markdown blocks. Returns null when no fence qualifies,
 * so `settleBlocks` falls through to the raw-paste heuristic.
 */
function extractFencedFiles(text: string): AgentBlock[] | null {
  const blocks: AgentBlock[] = [];
  let cursor = 0;
  for (const match of text.matchAll(MD_FENCE_RE)) {
    const content = match[1];
    if (content.split('\n').length < FENCE_MIN_LINES) continue;
    const start = match.index ?? 0;
    const before = text.slice(cursor, start);
    if (before.trim()) blocks.push({ kind: 'markdown', source: before.trim() });
    blocks.push(buildFileBlock(fenceFileName(before, content), content));
    cursor = start + match[0].length;
  }
  if (cursor === 0) return null;
  const rest = text.slice(cursor);
  if (rest.trim()) blocks.push({ kind: 'markdown', source: rest.trim() });
  return blocks;
}

/**
 * Called once streaming completes. Detects when the response IS a markdown
 * document (pasted file content) and returns a file card block rather than raw
 * text. Fenced ```markdown blocks are an explicit signal and are extracted
 * first, with no length threshold. Otherwise the raw-paste signals apply:
 * YAML front matter present, OR H1 heading that looks like a filename (has an
 * extension or is all-caps), AND total length > threshold.
 */
export function settleBlocks(text: string): AgentBlock[] {
  const fenced = extractFencedFiles(text);
  if (fenced) return fenced;

  if (text.length < DOCUMENT_MIN_CHARS) {
    return [{ kind: 'markdown', source: text }];
  }

  // YAML front matter is an unambiguous document signal
  const { frontMatter } = splitFrontMatter(text);
  if (frontMatter !== null) {
    const h1 = text.match(H1_RE);
    const rawName = h1?.[2]?.trim() ?? '';
    const name = /\.\w{1,6}$/.test(rawName) ? rawName : 'document.md';
    return [buildFileBlock(name, text)];
  }

  // Any H1 heading within the first 200 chars signals a pasted document
  const match = text.match(H1_RE);
  if (match && match[2] && (match.index ?? 0) < 200) {
    const headingText = match[2].trim();
    const docStart = (match.index ?? 0) + (match[0].startsWith('\n') ? 1 : 0);
    const intro = text.slice(0, docStart).trim();
    const name = /\.\w{1,6}$/.test(headingText) ? headingText : `${headingText}.md`;
    const docSource = text.slice(docStart).trim();
    const blocks: AgentBlock[] = [];
    if (intro) blocks.push({ kind: 'markdown', source: intro });
    blocks.push(buildFileBlock(name, docSource));
    return blocks;
  }

  return [{ kind: 'markdown', source: text }];
}

/** Keep useful partial output visible when a stream ends in an error. */
export function settleErrorBlocks(text: string, error: string): AgentBlock[] {
  const blocks = text.trim() ? settleBlocks(text) : [];
  const reason = error.trim() || 'Something went wrong.';
  return [
    ...blocks,
    { kind: 'text', spans: [{ text: `Failed: ${reason}` }], tone: 'error' },
  ];
}
