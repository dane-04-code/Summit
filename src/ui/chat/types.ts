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

export type AgentBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'text'; spans: Span[]; tone?: 'default' | 'muted' }
  | { kind: 'table'; rows: ServiceRow[] }
  | { kind: 'code'; lines: CodeLine[] }
  | { kind: 'chip'; state: RunState; label: string };

export type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'agent'; blocks: AgentBlock[] }
  | { id: string; role: 'action'; title: string; command: string };

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
