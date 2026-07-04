/**
 * Tier 2 generic adapter — any OpenAI-compatible server (Ollama, LM Studio,
 * llama.cpp, …). Probe is GET /v1/models; chat is SSE /v1/chat/completions.
 */

import type { Agent } from '@/agents/types';
import type { StreamEvent } from '@/agents/adapters/types';
import { ConnectionError } from '@/agents/adapters/types';

// react-native-sse is replaced by the manual mock in /__mocks__. Import it
// through the mocked specifier so the test and the adapter share one module
// instance (a direct path import would create a second copy).
jest.mock('react-native-sse');

import EventSourceModule from 'react-native-sse';
import type MockEventSourceType from '../../__mocks__/react-native-sse';
import { OpenAICompatAdapter } from '@/agents/adapters/openai';

const MockEventSource = EventSourceModule as unknown as typeof MockEventSourceType;
type MockEventSource = InstanceType<typeof MockEventSourceType>;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    name: 'Ollama',
    framework: 'openai',
    transport: 'direct',
    baseUrl: 'http://localhost:11434',
    capabilities: {
      framework: 'openai',
      hasRunApproval: false,
      hasRunStop: false,
      hasStreaming: true,
      hasJobs: false,
      hasSessions: false,
      chatModel: 'llama3',
    },
    createdAt: 0,
    lastUsedAt: 0,
    ...overrides,
  };
}

function makeAdapter(agent = makeAgent()) {
  return new OpenAICompatAdapter(agent, async () => 'sk-test');
}

async function waitForEventSource(): Promise<MockEventSource> {
  for (let i = 0; i < 20 && MockEventSource.instances.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  const es = MockEventSource.instances[0];
  if (!es) throw new Error('EventSource was never constructed');
  return es;
}

const fetchMock = jest.fn();

beforeEach(() => {
  MockEventSource.instances.length = 0;
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

// ── testConnection ───────────────────────────────────────────────────────────

describe('OpenAICompatAdapter.testConnection', () => {
  it('probes /v1/models and returns floor capabilities with the first model id', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ object: 'list', data: [{ id: 'llama3' }, { id: 'phi4' }] }),
    });

    const caps = await makeAdapter().testConnection();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
    expect(caps).toEqual({
      framework: 'openai',
      hasRunApproval: false,
      hasRunStop: false,
      hasStreaming: true,
      hasJobs: false,
      hasSessions: false,
      chatModel: 'llama3',
    });
  });

  it('still connects when the model list is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ object: 'list', data: [] }),
    });
    const caps = await makeAdapter().testConnection();
    expect(caps.chatModel).toBeUndefined();
  });

  it('maps 401 to unauthorized', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(makeAdapter().testConnection()).rejects.toMatchObject({
      name: 'ConnectionError',
      kind: 'unauthorized',
    });
  });

  it('maps a non-OpenAI response shape to wrong-shape', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    await expect(makeAdapter().testConnection()).rejects.toMatchObject({
      kind: 'wrong-shape',
    });
  });

  it('maps a network failure to unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(makeAdapter().testConnection()).rejects.toMatchObject({
      kind: 'unreachable',
    });
  });
});

// ── sendMessage ──────────────────────────────────────────────────────────────

describe('OpenAICompatAdapter.sendMessage', () => {
  it('streams deltas then done from SSE chunks', async () => {
    const adapter = makeAdapter();
    const collected: StreamEvent[] = [];
    const consume = (async () => {
      for await (const event of adapter.sendMessage('hi')) collected.push(event);
    })();

    const es = await waitForEventSource();
    es.emit('message', {
      data: JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
    });
    es.emit('message', {
      data: JSON.stringify({ choices: [{ delta: { content: 'lo' } }] }),
    });
    es.emit('message', { data: '[DONE]' });
    await consume;

    expect(collected).toEqual([
      { type: 'delta', text: 'Hel' },
      { type: 'delta', text: 'lo' },
      { type: 'done' },
    ]);
    expect(es.closed).toBe(true);
  });

  it('sends the stored model, auth header, and the user message', async () => {
    const adapter = makeAdapter();
    const consume = (async () => {
      for await (const event of adapter.sendMessage('hello there')) {
        void event; // drain
      }
    })();

    const es = await waitForEventSource();
    expect(es.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(es.options.method).toBe('POST');
    expect(es.options.headers?.Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(es.options.body ?? '{}');
    expect(body).toMatchObject({
      model: 'llama3',
      stream: true,
      messages: [{ role: 'user', content: 'hello there' }],
    });

    es.emit('message', { data: '[DONE]' });
    await consume;
  });

  it('surfaces a stream error as an error event', async () => {
    const adapter = makeAdapter();
    const collected: StreamEvent[] = [];
    const consume = (async () => {
      for await (const event of adapter.sendMessage('hi')) collected.push(event);
    })();

    const es = await waitForEventSource();
    es.emit('error', {});
    await consume;

    expect(collected).toEqual([
      { type: 'error', message: 'The connection to the agent dropped.' },
    ]);
  });
});

// ── capability-gated methods ─────────────────────────────────────────────────

describe('OpenAICompatAdapter capability-gated methods', () => {
  it.each([
    ['approveRun', (a: OpenAICompatAdapter) => a.approveRun('r1', true)],
    ['stopRun', (a: OpenAICompatAdapter) => a.stopRun('r1')],
    ['listJobs', (a: OpenAICompatAdapter) => a.listJobs()],
    ['getJobRun', (a: OpenAICompatAdapter) => a.getJobRun('j1')],
    ['pauseJob', (a: OpenAICompatAdapter) => a.pauseJob('j1')],
    ['resumeJob', (a: OpenAICompatAdapter) => a.resumeJob('j1')],
    ['triggerJob', (a: OpenAICompatAdapter) => a.triggerJob('j1')],
  ])('%s rejects — the generic floor has no runs or jobs', async (_name, call) => {
    await expect(call(makeAdapter())).rejects.toThrow(/doesn't support/);
  });
});

// ── construction guards ──────────────────────────────────────────────────────

describe('OpenAICompatAdapter construction', () => {
  it('requires a base URL', () => {
    expect(() => makeAdapter(makeAgent({ baseUrl: null }))).toThrow(ConnectionError);
  });
});
