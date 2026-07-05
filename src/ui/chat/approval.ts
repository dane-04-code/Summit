/**
 * Run-approval actions: turn a captured approval request into a thread card,
 * and resolve the user's decision through the agent adapter's Runs API.
 *
 * The screen's approve/stop buttons call these — the card carries the `runId`
 * so the decision reaches the actual run, rather than only editing local text.
 */

import type { AgentAdapter } from '@/agents/adapters/types';
import type { ApprovalRequest, Message } from './types';

/** A thread message that renders an approval card. */
export type ActionMessage = Extract<Message, { role: 'action' }>;

/** Build the interactive approval card for a pending request. */
export function buildApprovalMessage(id: string, req: ApprovalRequest): ActionMessage {
  return { id, role: 'action', runId: req.runId, title: req.title, command: req.command };
}

/** Resolve the card's run (approve/deny) through the adapter. */
export function submitApproval(
  adapter: Pick<AgentAdapter, 'approveRun'>,
  msg: ActionMessage,
  approved: boolean,
): Promise<void> {
  return adapter.approveRun(msg.runId, approved);
}

/** The user's decision on an approval card. */
export type ApprovalDecision = 'approve' | 'stop';

/** What replaces the card in the thread once the decision is resolved. */
export type ApprovalOutcome =
  | { ok: true; message: Message }
  | { ok: false; message: Message; error: unknown };

function resultMessage(cardId: string, text: string, muted = false): Message {
  return {
    id: `${cardId}-result`,
    role: 'agent',
    blocks: [{ kind: 'text', spans: [{ text }], ...(muted ? { tone: 'muted' as const } : {}) }],
  };
}

/**
 * Resolve a card's decision through the adapter and return the thread message
 * that replaces the card. On adapter failure the card's run is untouched, so
 * the copy says the run is still waiting.
 */
export async function resolveApproval(
  adapter: Pick<AgentAdapter, 'approveRun' | 'stopRun'>,
  msg: ActionMessage,
  decision: ApprovalDecision,
): Promise<ApprovalOutcome> {
  try {
    if (decision === 'approve') await submitApproval(adapter, msg, true);
    else await submitStop(adapter, msg);
  } catch (error) {
    return {
      ok: false,
      error,
      message: resultMessage(msg.id, 'Couldn’t reach the agent — the run is still waiting.', true),
    };
  }
  return {
    ok: true,
    message: resultMessage(
      msg.id,
      decision === 'approve' ? 'Approved — running the command now.' : 'Stopped. Nothing was run.',
    ),
  };
}

/** Stop the card's run through the adapter. */
export function submitStop(
  adapter: Pick<AgentAdapter, 'stopRun'>,
  msg: ActionMessage,
): Promise<void> {
  return adapter.stopRun(msg.runId);
}
