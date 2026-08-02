/**
 * Two paired agents living side by side in the live registry: pairing a second
 * one must not disturb the first's row, secret, or sessions, and switching must
 * survive a cold start. The pieces were always agent-list-shaped; this pins the
 * behaviour the switcher UI now depends on.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

import { InMemoryRepository } from '@/db/memory';

const mockRepo = new InMemoryRepository();
jest.mock('@/db', () => ({
  getRepository: () => mockRepo,
}));

// One Keychain, keyed exactly as `secrets.ts` keys it.
const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockKeychain.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockKeychain.delete(k);
  }),
}));

jest.mock('@/agents/adapters', () => ({
  makeAdapter: () => ({ subscribeConnectionState: () => () => {} }),
}));

// eslint-disable-next-line import/first
import { AgentProvider, useAgents } from '@/agents/AgentProvider';
// eslint-disable-next-line import/first
import type { NewAgentInput } from '@/agents/types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AgentProvider>{children}</AgentProvider>
);

function input(name: string): NewAgentInput {
  return { name, framework: 'hermes', transport: 'direct', baseUrl: 'host:8642' };
}

async function mountRegistry() {
  const { result } = await renderHook(() => useAgents(), { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  return result;
}

/** Pair two agents; returns their ids in pairing order. */
async function pairTwo(result: { current: ReturnType<typeof useAgents> }) {
  let first = '';
  let second = '';
  await act(async () => {
    first = (await result.current.addAgent(input('Workshop'), 'secret-1')).id;
  });
  await act(async () => {
    second = (await result.current.addAgent(input('Server box'), 'secret-2')).id;
  });
  return { first, second };
}

beforeEach(async () => {
  mockKeychain.clear();
  for (const agent of await mockRepo.listAgents()) await mockRepo.deleteAgent(agent.id);
  await mockRepo.setMeta('active_agent_id', '');
});

it('keeps both agents and switches into the newly paired one', async () => {
  const result = await mountRegistry();
  const { first, second } = await pairTwo(result);

  expect(result.current.agents.map((a) => a.name).sort()).toEqual(['Server box', 'Workshop']);
  expect(result.current.activeAgent?.id).toBe(second);
  // The first agent's secret is untouched by the second pairing.
  expect(mockKeychain.get(`agent.${first}.secret`)).toBe('secret-1');
  expect(mockKeychain.get(`agent.${second}.secret`)).toBe('secret-2');
});

it('switches the active agent and persists the choice', async () => {
  const result = await mountRegistry();
  const { first } = await pairTwo(result);

  await act(async () => {
    await result.current.selectAgent(first);
  });

  expect(result.current.activeAgent?.id).toBe(first);
  expect(await mockRepo.getMeta('active_agent_id')).toBe(first);
});

it('restores the last-active agent on a cold start with two paired', async () => {
  const first = await mountRegistry().then(async (result) => {
    const ids = await pairTwo(result);
    await act(async () => {
      await result.current.selectAgent(ids.first);
    });
    return ids.first;
  });

  // Fresh provider over the same store — what an app relaunch sees.
  const relaunched = await mountRegistry();
  expect(relaunched.current.agents).toHaveLength(2);
  expect(relaunched.current.activeAgent?.id).toBe(first);
});

it('keeps each agent’s sessions to itself', async () => {
  const result = await mountRegistry();
  const { first, second } = await pairTwo(result);

  const now = Date.now();
  await mockRepo.upsertSession({
    id: 's1', agentId: first, title: 'A thread', remoteSessionKey: null,
    createdAt: now, updatedAt: now,
  });
  await mockRepo.upsertSession({
    id: 's2', agentId: second, title: 'B thread', remoteSessionKey: null,
    createdAt: now, updatedAt: now,
  });

  expect((await mockRepo.listSessions(first)).map((s) => s.id)).toEqual(['s1']);
  expect((await mockRepo.listSessions(second)).map((s) => s.id)).toEqual(['s2']);
});

it('removing one agent leaves the other’s secret and sessions intact', async () => {
  const result = await mountRegistry();
  const { first, second } = await pairTwo(result);

  const now = Date.now();
  await mockRepo.upsertSession({
    id: 's1', agentId: first, title: 'A thread', remoteSessionKey: null,
    createdAt: now, updatedAt: now,
  });

  await act(async () => {
    await result.current.removeAgent(second);
  });

  expect(result.current.agents.map((a) => a.id)).toEqual([first]);
  expect(result.current.activeAgent?.id).toBe(first);
  expect(mockKeychain.get(`agent.${first}.secret`)).toBe('secret-1');
  expect(mockKeychain.has(`agent.${second}.secret`)).toBe(false);
  expect(await mockRepo.listSessions(first)).toHaveLength(1);
});
