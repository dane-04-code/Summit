import type { AgentAdapter, SettledReply } from '@/agents/adapters/types';
import type { Repository } from '@/db';
import type { Message } from './types';
import { settleBlocks, settleErrorBlocks } from './streamReducer';

export const recoveredMessageId = (eventId: string) => `relay-reply-${eventId}`;

export function messageForSettledReply(reply: SettledReply): Message {
  return {
    id: recoveredMessageId(reply.id),
    role: 'agent',
    blocks: reply.status === 'done'
      ? settleBlocks(reply.content)
      : settleErrorBlocks(reply.content, reply.error || 'The agent hit a problem.'),
  };
}

/**
 * Persist replies completed by the connector while iOS had suspended Summit.
 * Stable message IDs make this idempotent if an acknowledgement is lost.
 */
export async function recoverPendingReplies(
  repo: Repository,
  adapter: AgentAdapter,
): Promise<string[]> {
  if (!adapter.syncPendingReplies || !adapter.acknowledgeReplies) return [];
  const replies = await adapter.syncPendingReplies();
  const changedSessions = new Set<string>();
  const acknowledged: string[] = [];

  for (const reply of replies) {
    const session = await repo.getSession(reply.sessionId);
    if (!session) {
      // The user may have deleted the thread while the connector was working.
      // Do not recreate it; simply retire the orphaned result.
      acknowledged.push(reply.id);
      continue;
    }
    const createdAt = Math.max(reply.createdAt, session.updatedAt + 1);
    const message = messageForSettledReply(reply);
    await repo.appendMessage({
      id: message.id,
      sessionId: session.id,
      message,
      createdAt,
    });
    await repo.upsertSession({ ...session, updatedAt: createdAt });
    changedSessions.add(session.id);
    acknowledged.push(reply.id);
  }

  await adapter.acknowledgeReplies(acknowledged);
  return [...changedSessions];
}
