jest.mock('react-native-sse');
jest.mock('@/config', () => ({ RELAY_WS_URL: 'ws://test', SIGNUP_ENABLED: false }));

import { makeAdapter } from '@/agents/adapters';
import { HermesAdapter } from '@/agents/adapters/hermes';
import { OpenAICompatAdapter } from '@/agents/adapters/openai';
import { RelayAdapter } from '@/agents/adapters/relay';
import type { Agent, AgentFramework, AgentTransport } from '@/agents/types';

function agent(framework: AgentFramework, transport: AgentTransport): Agent {
  return {
    id: 'a1',
    name: 'A',
    framework,
    transport,
    baseUrl: transport === 'direct' ? 'http://localhost:8642' : null,
    capabilities: null,
    createdAt: 0,
    lastUsedAt: 0,
  };
}

const secret = async () => 'k';

describe('makeAdapter', () => {
  it('routes direct Hermes to the Hermes adapter', () => {
    expect(makeAdapter(agent('hermes', 'direct'), secret)).toBeInstanceOf(HermesAdapter);
  });

  it('routes direct generic agents to the OpenAI-compatible adapter', () => {
    expect(makeAdapter(agent('openai', 'direct'), secret)).toBeInstanceOf(OpenAICompatAdapter);
  });

  it('routes any relay agent to the relay adapter, keeping its framework', () => {
    const hermesRelay = makeAdapter(agent('hermes', 'relay'), secret);
    expect(hermesRelay).toBeInstanceOf(RelayAdapter);
    expect(hermesRelay.framework).toBe('hermes');

    const genericRelay = makeAdapter(agent('openai', 'relay'), secret);
    expect(genericRelay).toBeInstanceOf(RelayAdapter);
    expect(genericRelay.framework).toBe('openai');
  });
});
