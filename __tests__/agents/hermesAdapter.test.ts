jest.mock('react-native-sse');

import EventSourceModule from 'react-native-sse';
import type MockEventSourceType from '../../__mocks__/react-native-sse';
import { HermesAdapter, normalizeBaseUrl } from '@/agents/adapters/hermes';
import { ConnectionError, type StreamEvent } from '@/agents/adapters/types';
import type { Agent } from '@/agents/types';

const MockEventSource = EventSourceModule as unknown as typeof MockEventSourceType;

describe('normalizeBaseUrl', () => {
  it('defaults bare direct-mode hosts to https', () => {
    expect(normalizeBaseUrl('my-hermes.example.com:8642')).toBe(
      'https://my-hermes.example.com:8642',
    );
  });

  it('preserves explicit https URLs', () => {
    expect(normalizeBaseUrl('https://my-hermes.example.com:8642/')).toBe(
      'https://my-hermes.example.com:8642',
    );
  });

  it('allows explicit http only for local/private direct-mode hosts', () => {
    expect(normalizeBaseUrl('http://localhost:8642')).toBe('http://localhost:8642');
    expect(normalizeBaseUrl('http://100.80.1.2:8642')).toBe('http://100.80.1.2:8642');
    expect(normalizeBaseUrl('http://192.168.1.10:8642')).toBe('http://192.168.1.10:8642');
  });

  it('rejects explicit http for public hosts', () => {
    expect(() => normalizeBaseUrl('http://hermes.example.com:8642')).toThrow(ConnectionError);
  });
});

describe('HermesAdapter.sendMessage', () => {
  const agent: Agent = {
    id: 'a1',
    name: 'Hermes',
    framework: 'hermes',
    transport: 'direct',
    baseUrl: 'http://localhost:8642',
    capabilities: null,
    createdAt: 0,
    lastUsedAt: 0,
  };

  beforeEach(() => {
    MockEventSource.instances.length = 0;
  });

  it('streams deltas, tool progress, and done with Hermes session headers', async () => {
    const adapter = new HermesAdapter(agent, async () => 'key-1');
    const collected: StreamEvent[] = [];
    const consume = (async () => {
      for await (const event of adapter.sendMessage('hi', {
        sessionId: 's-1',
        sessionKey: 'k-1',
      })) {
        collected.push(event);
      }
    })();

    for (let i = 0; i < 20 && MockEventSource.instances.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    const es = MockEventSource.instances[0];
    expect(es.url).toBe('http://localhost:8642/v1/chat/completions');
    expect(es.options.headers).toMatchObject({
      Authorization: 'Bearer key-1',
      'X-Hermes-Session-Id': 's-1',
      'X-Hermes-Session-Key': 'k-1',
    });
    expect(JSON.parse(es.options.body ?? '{}')).toMatchObject({
      model: 'hermes-agent',
      stream: true,
      messages: [{ role: 'user', content: 'hi' }],
    });

    es.emit('message', {
      data: JSON.stringify({ choices: [{ delta: { content: 'Hey' } }] }),
    });
    es.emit('hermes.tool.progress', { data: JSON.stringify({ label: 'Reading file' }) });
    es.emit('message', { data: '[DONE]' });
    await consume;

    expect(collected).toEqual([
      { type: 'delta', text: 'Hey' },
      { type: 'tool', label: 'Reading file' },
      { type: 'done' },
    ]);
  });
});
