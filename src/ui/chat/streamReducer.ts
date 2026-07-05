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
    case 'tool':
      return { ...turn, toolLabel: event.label };
    case 'approval':
      return {
        ...turn,
        pendingApproval: {
          runId: event.runId,
          title: event.title,
          command: event.command,
        },
      };
    case 'done':
      return { ...turn, status: 'idle', done: true };
    case 'error':
      return { ...turn, status: 'error', error: event.message, done: true };
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

/** The agent message body for a turn: a single markdown block of accumulated text. */
export function turnToBlocks(turn: LiveTurn): AgentBlock[] {
  return [{ kind: 'markdown', source: turn.text }];
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

/**
 * Called once streaming completes. Detects when the response IS a markdown
 * document (pasted file content) and returns a file card block rather than raw
 * text. Signals: YAML front matter present, OR H1 heading that looks like a
 * filename (has an extension or is all-caps), AND total length > threshold.
 */
export function settleBlocks(text: string): AgentBlock[] {
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
