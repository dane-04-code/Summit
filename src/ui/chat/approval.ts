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

/** Stop the card's run through the adapter. */
export function submitStop(
  adapter: Pick<AgentAdapter, 'stopRun'>,
  msg: ActionMessage,
): Promise<void> {
  return adapter.stopRun(msg.runId);
}
