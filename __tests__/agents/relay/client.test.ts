import { RelayClient } from '@/agents/relay/client';

// Models a real WebSocket's open handshake: it starts in CONNECTING and only
// becomes usable once `openNow()` fires `onopen`. The client awaits that event
// before sending, so tests must open the socket and let a tick pass (so the
// client's awaited continuation registers its handler + sends) before feeding
// frames in with `receive()`.
class MockWebSocket {
  static OPEN = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  readyState = 0; // CONNECTING until opened

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }
  receive(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  openNow() { this.readyState = MockWebSocket.OPEN; this.onopen?.(); }
}

// Drain microtasks + the awaited connect() chain (real timers, so setTimeout(0)
// settles after all pending microtasks).
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

let mockWs: MockWebSocket;
let client: RelayClient;
const OriginalWebSocket = (globalThis as any).WebSocket;

beforeEach(() => {
  mockWs = new MockWebSocket();
  (globalThis as any).WebSocket = jest.fn(() => mockWs);
  (globalThis as any).WebSocket.OPEN = MockWebSocket.OPEN;
});

afterEach(() => {
  // Stops the heartbeat interval so the worker can exit cleanly.
  client?.disconnect();
  (globalThis as any).WebSocket = OriginalWebSocket;
});

describe('pair()', () => {
  it('resolves with agent info on paired frame', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    const promise = client.pair('111111');
    mockWs.openNow();
    await flush();
    expect(JSON.parse(mockWs.sent[0])).toEqual({ t: 'pair', code: '111111' });

    mockWs.receive({ t: 'paired', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
    const info = await promise;
    expect(info).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1' });
  });

  it('rejects on pair_error', async () => {
    client = new RelayClient('ws://localhost:8787?code=badcode');
    const promise = client.pair('badcode');
    mockWs.openNow();
    await flush();

    mockWs.receive({ t: 'pair_error', reason: 'not_found' });
    await expect(promise).rejects.toThrow('not_found');
  });
});

describe('chat()', () => {
  it('yields delta events then done', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-1');
    const collecting = (async () => {
      for await (const ev of gen) events.push(ev);
    })();

    await flush();      // generator reaches `await connect()` and wires onopen
    mockWs.openNow();
    await flush();      // connect resolves → chat frame sent + handler registered

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
    client = new RelayClient('ws://localhost:8787?code=111111');

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-2');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    await flush();
    mockWs.openNow();
    await flush();

    mockWs.receive({ t: 'error', reqId: 'req-2', message: 'upstream failed' });
    await collecting;
    expect(events).toEqual([{ type: 'error', message: 'upstream failed' }]);
  });

  it('yields error event on peer_gone', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'hi' }], 'req-3');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    await flush();
    mockWs.openNow();
    await flush();

    mockWs.receive({ t: 'peer_gone' });
    await collecting;
    expect(events).toEqual([{ type: 'error', message: 'Agent disconnected.' }]);
  });
});
