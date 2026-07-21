import type { AgentAdapter, SettledReply } from '@/agents/adapters/types';
import { InMemoryRepository } from '@/db/memory';
import { recoverPendingReplies, recoveredMessageId } from '@/ui/chat/recoverReplies';

const reply: SettledReply = {
  id: 'event-1',
  reqId: 'req-1',
  sessionId: 'session-1',
  status: 'done',
  content: '# Finished\n\nThis completed while the phone was off.',
  createdAt: 20,
};

describe('recoverPendingReplies', () => {
  it('persists and acknowledges a connector-owned reply idempotently', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertSession({
      id: 'session-1', agentId: 'agent-1', title: 'Chat', remoteSessionKey: 'remote-1',
      createdAt: 10, updatedAt: 15,
    });
    const acknowledgeReplies = jest.fn(async () => {});
    const adapter = {
      syncPendingReplies: jest.fn(async () => [reply]),
      acknowledgeReplies,
    } as unknown as AgentAdapter;

    await expect(recoverPendingReplies(repo, adapter)).resolves.toEqual([
      { sessionId: 'session-1', createdAt: 20, scheduledWork: false },
    ]);
    await expect(recoverPendingReplies(repo, adapter)).resolves.toEqual([
      { sessionId: 'session-1', createdAt: 20, scheduledWork: false },
    ]);

    const stored = await repo.listMessages('session-1');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(recoveredMessageId('event-1'));
    expect(acknowledgeReplies).toHaveBeenCalledWith(['event-1']);
  });

  it('acknowledges a reply for a thread the user deleted without recreating it', async () => {
    const repo = new InMemoryRepository();
    const acknowledgeReplies = jest.fn(async () => {});
    const adapter = {
      syncPendingReplies: jest.fn(async () => [reply]),
      acknowledgeReplies,
    } as unknown as AgentAdapter;

    await expect(recoverPendingReplies(repo, adapter)).resolves.toEqual([]);
    expect(acknowledgeReplies).toHaveBeenCalledWith(['event-1']);
    expect(await repo.getSession('session-1')).toBeNull();
  });

  it('creates the dedicated scheduled-work thread for a trusted host delivery', async () => {
    const repo = new InMemoryRepository();
    const scheduled = { ...reply, sessionId: 'summit-scheduled-0123456789abcdef01234567' };
    const adapter = {
      syncPendingReplies: jest.fn(async () => [scheduled]),
      acknowledgeReplies: jest.fn(async () => {}),
    } as unknown as AgentAdapter;

    await expect(recoverPendingReplies(repo, adapter, 'agent-1')).resolves.toEqual([
      { sessionId: scheduled.sessionId, createdAt: 20, scheduledWork: true },
    ]);
    expect(await repo.getSession(scheduled.sessionId)).toMatchObject({
      agentId: 'agent-1',
      title: 'Scheduled work',
    });
  });

  it('keeps partial text before an error note', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertSession({
      id: 'session-1', agentId: 'agent-1', title: null, remoteSessionKey: null,
      createdAt: 10, updatedAt: 15,
    });
    const adapter = {
      syncPendingReplies: async () => [{ ...reply, status: 'error' as const, content: 'Useful partial', error: 'Gateway restarted' }],
      acknowledgeReplies: async () => {},
    } as unknown as AgentAdapter;

    await recoverPendingReplies(repo, adapter);
    const stored = await repo.listMessages('session-1');
    const message = stored[0].message;
    expect(message.role).toBe('agent');
    if (message.role === 'agent') {
      expect(message.blocks).toHaveLength(2);
    }
  });
});
