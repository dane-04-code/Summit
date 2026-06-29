import { RelayClient } from '@/agents/relay/client';

class MockWebSocket {
  static OPEN = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  readyState = 1;

  send(data: string) { this.sent.push(data); }
  close() { this.onclose?.(); }
  receive(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  openNow() { this.readyState = 1; this.onopen?.(); }
}

let mockWs: MockWebSocket;
const OriginalWebSocket = (globalThis as any).WebSocket;

beforeEach(() => {
  mockWs = new MockWebSocket();
  (globalThis as any).WebSocket = jest.fn(() => mockWs);
  (globalThis as any).WebSocket.OPEN = MockWebSocket.OPEN;
});

afterEach(() => {
  (globalThis as any).WebSocket = OriginalWebSocket;
});

describe('pair()', () => {
  it('resolves with agent info on paired frame', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    const promise = client.pair('111111');
    mockWs.openNow();
    mockWs.receive({ t: 'paired', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    const info = await promise;
    expect(info).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    expect(JSON.parse(mockWs.sent[0])).toEqual({ t: 'pair', code: '111111' });
  });

  it('rejects on pair_error', async () => {
    const client = new RelayClient('ws://localhost:8787?code=badcode');
    const promise = client.pair('badcode');
    mockWs.openNow();
    mockWs.receive({ t: 'pair_error', reason: 'not_found' });
    await expect(promise).rejects.toThrow('not_found');
  });
});

describe('chat()', () => {
  it('yields delta events then done', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    mockWs.readyState = 1;

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-1');

    const collecting = (async () => {
      for await (const ev of gen) events.push(ev);
    })();

    expect(JSON.parse(mockWs.sent[0])).toMatchObject({ t: 'chat', reqId: 'req-1' });
    mockWs.receive({ t: 'chunk', reqId: 'req-1', delta: 'He' });
    mockWs.receive({ t: 'chunk', reqId: 'req-1', delta: 'llo' });
    mockWs.receive({ t: 'done', reqId: 'req-1' });

    await collecting;
    expect(events).toEqual([
      { type: 'delta', text: 'He' },
      { type: 'delta', text: 'llo' },
      { type: 'done' },
    ]);
  });

  it('yields error event on error frame', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    mockWs.readyState = 1;

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-2');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    mockWs.receive({ t: 'error', reqId: 'req-2', message: 'upstream failed' });
    await collecting;
    expect(events).toEqual([{ type: 'error', message: 'upstream failed' }]);
  });

  it('yields error event on peer_gone', async () => {
    const client = new RelayClient('ws://localhost:8787?code=111111');
    mockWs.readyState = 1;

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-3');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    mockWs.receive({ t: 'peer_gone' });
    await collecting;
    expect(events).toEqual([{ type: 'error', message: 'Agent disconnected.' }]);
  });
});
