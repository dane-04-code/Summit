import {
  buildAgent,
  removeAgent,
  resolveActive,
  sortByRecent,
  touchAgent,
  upsertAgent,
} from '@/agents/registry';
import type { Agent } from '@/agents/types';

function mk(id: string, lastUsedAt: number): Agent {
  return {
    id,
    name: `agent-${id}`,
    framework: 'hermes',
    transport: 'direct',
    baseUrl: 'http://host:8642',
    capabilities: null,
    createdAt: lastUsedAt,
    lastUsedAt,
  };
}

describe('buildAgent', () => {
  it('assigns an id and mirrors timestamps from `now`', () => {
    const agent = buildAgent(
      { name: 'Hermes', framework: 'hermes', transport: 'direct', baseUrl: 'h:8642' },
      1000,
    );
    expect(agent.id).toBeTruthy();
    expect(agent.createdAt).toBe(1000);
    expect(agent.lastUsedAt).toBe(1000);
    expect(agent.capabilities).toBeNull();
  });
});

describe('upsertAgent', () => {
  it('replaces by id rather than duplicating, keeping recency order', () => {
    const list = [mk('a', 1), mk('b', 2)];
    const next = upsertAgent(list, { ...mk('a', 5) });
    expect(next.map((a) => a.id)).toEqual(['a', 'b']);
    expect(next).toHaveLength(2);
  });
});

describe('touchAgent', () => {
  it('bumps lastUsedAt and re-sorts; no-op for an unknown id', () => {
    const list = [mk('a', 1), mk('b', 2)];
    const touched = touchAgent(list, 'a', 9);
    expect(touched[0].id).toBe('a');
    expect(touched[0].lastUsedAt).toBe(9);
    expect(touchAgent(list, 'missing', 9)).toHaveLength(2);
  });
});

describe('removeAgent', () => {
  it('drops the matching id', () => {
    expect(removeAgent([mk('a', 1), mk('b', 2)], 'a').map((a) => a.id)).toEqual(['b']);
  });
});

describe('resolveActive', () => {
  it('prefers the requested id, falls back to most recent, else null', () => {
    const list = [mk('a', 1), mk('b', 3), mk('c', 2)];
    expect(resolveActive(list, 'a')?.id).toBe('a');
    expect(resolveActive(list, 'gone')?.id).toBe('b');
    expect(resolveActive([], 'a')).toBeNull();
  });
});

describe('sortByRecent', () => {
  it('orders most-recently-used first without mutating input', () => {
    const list = [mk('a', 1), mk('b', 3)];
    expect(sortByRecent(list).map((a) => a.id)).toEqual(['b', 'a']);
    expect(list.map((a) => a.id)).toEqual(['a', 'b']);
  });
});
