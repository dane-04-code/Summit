/**
 * Fold a stream of normalized adapter events into the live agent turn. Pure and
 * synchronous so the accumulation logic is unit-tested without rendering or a
 * network. The chat screen holds a `LiveTurn` per in-flight reply and renders
 * `turnToBlocks(turn)` after each event. Persist the settled turn once `done`
 * (docs/AGENTS.md §7) — never the deltas.
 */

import type { StreamEvent } from '@/agents/adapters/types';
import type { AgentBlock } from './types';

export type LiveTurn = {
  text: string;
  toolLabel: string | null;
  status: 'running' | 'idle' | 'error';
  error: string | null;
  done: boolean;
};

export const initialTurn: LiveTurn = {
  text: '',
  toolLabel: null,
  status: 'running',
  error: null,
  done: false,
};

export function reduceTurn(turn: LiveTurn, event: StreamEvent): LiveTurn {
  switch (event.type) {
    case 'delta':
      return { ...turn, text: turn.text + event.text };
    case 'tool':
      return { ...turn, toolLabel: event.label };
    case 'done':
      return { ...turn, status: 'idle', done: true };
    case 'error':
      return { ...turn, status: 'error', error: event.message, done: true };
    default:
      return turn;
  }
}

/** The agent message body for a turn: a single markdown block of accumulated text. */
export function turnToBlocks(turn: LiveTurn): AgentBlock[] {
  return [{ kind: 'markdown', source: turn.text }];
}
