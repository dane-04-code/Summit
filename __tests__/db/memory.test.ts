import { InMemoryRepository } from '@/db/memory';
import type { Agent, ChatSession, StoredMessage } from '@/agents/types';

function agent(id: string, lastUsedAt: number): Agent {
  return {
    id,
    name: `agent-${id}`,
    framework: 'hermes',
    transport: 'direct',
    baseUrl: 'http://host:8642',
    capabilities: { framework: 'hermes', hasRunApproval: true, hasRunStop: true, hasStreaming: true, hasJobs: false, hasSessions: true },
    createdAt: lastUsedAt,
    lastUsedAt,
  };
}

function session(id: string, agentId: string, updatedAt: number): ChatSession {
  return { id, agentId, title: null, remoteSessionKey: null, createdAt: updatedAt, updatedAt };
}

function message(id: string, sessionId: string, createdAt: number): StoredMessage {
  return { id, sessionId, message: { id, role: 'user', text: `m${id}` }, createdAt };
}

describe('InMemoryRepository', () => {
  it('lists agents most-recently-used first', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertAgent(agent('a', 1));
    await repo.upsertAgent(agent('b', 3));
    await repo.upsertAgent(agent('c', 2));
    expect((await repo.listAgents()).map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('round-trips an agent including its capabilities snapshot', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertAgent(agent('a', 1));
    const got = await repo.getAgent('a');
    expect(got?.capabilities?.hasRunApproval).toBe(true);
  });

  it('persists messages in chronological order', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertSession(session('s1', 'a', 1));
    await repo.appendMessage(message('m2', 's1', 200));
    await repo.appendMessage(message('m1', 's1', 100));
    expect((await repo.listMessages('s1')).map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('cascades delete: removing an agent clears its sessions and messages', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertAgent(agent('a', 1));
    await repo.upsertSession(session('s1', 'a', 1));
    await repo.appendMessage(message('m1', 's1', 1));

    await repo.deleteAgent('a');

    expect(await repo.getAgent('a')).toBeNull();
    expect(await repo.listSessions('a')).toEqual([]);
    expect(await repo.listMessages('s1')).toEqual([]);
  });

  it('stores and reads app meta', async () => {
    const repo = new InMemoryRepository();
    expect(await repo.getMeta('active_agent_id')).toBeNull();
    await repo.setMeta('active_agent_id', 'a');
    expect(await repo.getMeta('active_agent_id')).toBe('a');
  });
});
