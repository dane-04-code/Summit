/**
 * The model-picker round trips over the relay. Same MockWebSocket shape as
 * `client.test.ts`: the socket only becomes usable after `openNow()`, and the
 * client registers its handler on an awaited continuation, so a flush has to
 * run before frames are fed in.
 */

import { RelayClient } from '@/agents/relay/client';

class MockWebSocket {
  static OPEN = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  readyState = 0;

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  openNow() { this.readyState = MockWebSocket.OPEN; this.onopen?.(); }
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

let mockWs: MockWebSocket;
let client: RelayClient;
const OriginalWebSocket = (globalThis as any).WebSocket;

beforeEach(() => {
  mockWs = new MockWebSocket();
  (globalThis as any).WebSocket = jest.fn(() => mockWs);
  (globalThis as any).WebSocket.OPEN = MockWebSocket.OPEN;
  client = new RelayClient('ws://localhost:8787');
  (client as any).paired = true;
});

afterEach(() => {
  client?.disconnect();
  (globalThis as any).WebSocket = OriginalWebSocket;
});

/**
 * Open the socket and let the client's awaited continuation register.
 * The leading flush matters: `listModels`/`selectModel` await authentication
 * before they call `connect()`, so opening the socket too early would open one
 * the client has not created yet and leave the real one pending forever.
 */
async function connected(): Promise<void> {
  await flush();
  mockWs.openNow();
  await flush();
}

const PROVIDERS = [
  { slug: 'anthropic', name: 'Anthropic', isCurrent: true, models: ['claude-opus-5'] },
];

describe('pair capabilities', () => {
  it('carries the connector capability list through to the caller', async () => {
    const promise = client.pair('111111');
    await connected();
    mockWs.receive({
      t: 'paired',
      framework: 'hermes',
      agentName: 'A',
      agentVersion: '1',
      sessionToken: 't'.repeat(43),
      capabilities: ['model_picker'],
    });

    await expect(promise).resolves.toMatchObject({ capabilities: ['model_picker'] });
  });

  it('omits capabilities entirely for a connector that advertised none', async () => {
    const promise = client.pair('111111');
    await connected();
    mockWs.receive({
      t: 'paired',
      framework: 'hermes',
      agentName: 'A',
      agentVersion: '1',
      sessionToken: 't'.repeat(43),
    });

    await expect(promise).resolves.not.toHaveProperty('capabilities');
  });
});

describe('listModels()', () => {
  it('asks for the requested scope and returns the host catalogue', async () => {
    const promise = client.listModels('session-1', 'session');
    await connected();

    const sent = JSON.parse(mockWs.sent[0]);
    expect(sent).toMatchObject({ t: 'models_req', sessionId: 'session-1', scope: 'session' });

    mockWs.receive({
      t: 'models',
      reqId: sent.reqId,
      currentModel: 'claude-sonnet-5',
      currentProvider: 'anthropic',
      providers: PROVIDERS,
    });

    await expect(promise).resolves.toEqual({
      currentModel: 'claude-sonnet-5',
      currentProvider: 'anthropic',
      providers: PROVIDERS,
    });
  });

  it('ignores a catalogue answering a different request', async () => {
    const promise = client.listModels('session-1', 'default');
    await connected();
    const sent = JSON.parse(mockWs.sent[0]);

    mockWs.receive({
      t: 'models',
      reqId: 'someone-else',
      currentModel: 'x',
      currentProvider: 'y',
      providers: [],
    });
    mockWs.receive({
      t: 'models',
      reqId: sent.reqId,
      currentModel: 'claude-sonnet-5',
      currentProvider: 'anthropic',
      providers: PROVIDERS,
    });

    await expect(promise).resolves.toMatchObject({ currentModel: 'claude-sonnet-5' });
  });

  it('rejects with the host message when the picker cannot open', async () => {
    const promise = client.listModels('session-1', 'default');
    await connected();
    const sent = JSON.parse(mockWs.sent[0]);

    mockWs.receive({ t: 'error', reqId: sent.reqId, message: 'This Hermes build has no model list.' });

    await expect(promise).rejects.toThrow('This Hermes build has no model list.');
  });

  it('rejects when the agent drops mid-request', async () => {
    const promise = client.listModels('session-1', 'default');
    await connected();

    mockWs.receive({ t: 'peer_gone' });

    await expect(promise).rejects.toThrow('Agent disconnected.');
  });
});

describe('selectModel()', () => {
  it('resolves with the host note for the switch it made', async () => {
    const promise = client.selectModel('session-1', 'anthropic', 'claude-opus-5');
    await connected();

    const sent = JSON.parse(mockWs.sent[0]);
    expect(sent).toMatchObject({
      t: 'model_select',
      sessionId: 'session-1',
      provider: 'anthropic',
      model: 'claude-opus-5',
    });

    mockWs.receive({
      t: 'model_result',
      reqId: sent.reqId,
      model: 'claude-opus-5',
      provider: 'anthropic',
      message: 'Model switched to `claude-opus-5`',
    });

    await expect(promise).resolves.toBe('Model switched to `claude-opus-5`');
  });

  it('rejects a switch the host refused rather than reporting success', async () => {
    const promise = client.selectModel('session-1', 'openai', 'gpt-5.2');
    await connected();
    const sent = JSON.parse(mockWs.sent[0]);

    mockWs.receive({
      t: 'error',
      reqId: sent.reqId,
      message: 'Error: switch failed; staying on claude-sonnet-5.',
    });

    await expect(promise).rejects.toThrow('staying on claude-sonnet-5');
  });
});
