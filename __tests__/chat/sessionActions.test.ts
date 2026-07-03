import { InMemoryRepository } from '@/db/memory';
import { renameSession } from '@/ui/chat/sessionActions';
import type { ChatSession } from '@/agents/types';

function session(id: string): ChatSession {
  const now = Date.now();
  return {
    id,
    agentId: 'a1',
    title: 'Old title',
    remoteSessionKey: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe('renameSession', () => {
  it('trims and saves a new title', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertSession(session('s1'));
    expect(await renameSession(repo, 's1', '  New title  ')).toBe(true);
    expect((await repo.getSession('s1'))?.title).toBe('New title');
  });

  it('rejects empty titles and missing sessions', async () => {
    const repo = new InMemoryRepository();
    await repo.upsertSession(session('s1'));
    expect(await renameSession(repo, 's1', '   ')).toBe(false);
    expect(await renameSession(repo, 'nope', 'X')).toBe(false);
    expect((await repo.getSession('s1'))?.title).toBe('Old title');
  });
});
