import type { AgentAdapter, SettledReply } from '@/agents/adapters/types';
import type { ChatSession } from '@/agents/types';
import type { Repository } from '@/db';
import type { Message } from './types';
import { settleBlocks, settleErrorBlocks } from './streamReducer';

export const recoveredMessageId = (eventId: string) => `relay-reply-${eventId}`;

/** A private stable session id derived on the paired agent host, never a user prompt. */
export const isScheduledWorkSession = (sessionId: string) => /^summit-scheduled-[a-f0-9]{24}$/.test(sessionId);

export type RecoveredReply = {
  sessionId: string;
  createdAt: number;
  scheduledWork: boolean;
};

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
  agentId?: string,
): Promise<RecoveredReply[]> {
  if (!adapter.syncPendingReplies || !adapter.acknowledgeReplies) return [];
  const replies = await adapter.syncPendingReplies();
  const recovered: RecoveredReply[] = [];
  const acknowledged: string[] = [];

  for (const reply of replies) {
    let session = await repo.getSession(reply.sessionId);
    if (!session && agentId && isScheduledWorkSession(reply.sessionId)) {
      const createdAt = reply.createdAt;
      session = {
        id: reply.sessionId,
        agentId,
        title: 'Scheduled work',
        remoteSessionKey: null,
        createdAt,
        updatedAt: createdAt,
      } satisfies ChatSession;
      await repo.upsertSession(session);
    }
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
    recovered.push({
      sessionId: session.id,
      createdAt: reply.createdAt,
      scheduledWork: isScheduledWorkSession(session.id),
    });
    acknowledged.push(reply.id);
  }

  await adapter.acknowledgeReplies(acknowledged);
  return recovered;
}
