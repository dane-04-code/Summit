import { RelayClient } from '@/agents/relay/client';
import { RelayError } from '@/agents/relay/errors';

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

function markAuthenticated(target: RelayClient) {
  // Stream-routing tests start after the separately tested relay handshake.
  (target as any).paired = true;
}

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

    mockWs.receive({ t: 'paired', framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1', sessionToken: 't'.repeat(43) });
    const info = await promise;
    expect(info).toEqual({ framework: 'hermes', agentName: 'My Agent', agentVersion: '2.1', sessionToken: 't'.repeat(43) });
  });

  it.each([
    ['not_found', 'code_not_found'],
    ['expired', 'code_expired'],
    ['already_paired', 'already_paired'],
  ] as const)('classifies pair_error %s as RelayError %s', async (reason, code) => {
    client = new RelayClient('ws://localhost:8787?code=badcode');
    const promise = client.pair('badcode');
    mockWs.openNow();
    await flush();

    mockWs.receive({ t: 'pair_error', reason });
    await expect(promise).rejects.toBeInstanceOf(RelayError);
    await expect(promise).rejects.toMatchObject({ code });
  });

  it('classifies peer_gone during pairing as agent_disconnected', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    const promise = client.pair('111111');
    mockWs.openNow();
    await flush();

    mockWs.receive({ t: 'peer_gone' });
    await expect(promise).rejects.toMatchObject({ code: 'agent_disconnected' });
  });

  it('classifies a socket error before open as relay_unreachable', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    const promise = client.pair('111111');
    mockWs.onerror?.({} as Event);
    await expect(promise).rejects.toMatchObject({ code: 'relay_unreachable' });
  });
});

describe('registerPush()', () => {
  it('sends a register_push frame with the token', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const promise = client.registerPush('ExponentPushToken[t1]', 'all');
    await flush();
    mockWs.openNow();
    await flush();
    await promise;
    expect(JSON.parse(mockWs.sent[0])).toEqual({
      t: 'register_push',
      token: 'ExponentPushToken[t1]',
      mode: 'all',
    });
  });
});

describe('proactive delivery signals', () => {
  it('notifies subscribers without exposing the reply content', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const listener = jest.fn();
    const unsubscribe = client.subscribeNotifications(listener);

    const connecting = client.registerPush(null, 'all');
    await flush();
    mockWs.openNow();
    await connecting;
    mockWs.receive({ t: 'notify', title: 'Scheduled work finished' });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    mockWs.receive({ t: 'notify', title: 'Scheduled work finished' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('resume()', () => {
  it('authenticates with the durable device token', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111&token=durable-token');
    const promise = client.resume('durable-token');
    mockWs.openNow();
    await flush();
    expect(JSON.parse(mockWs.sent[0])).toEqual({ t: 'resume', token: 'durable-token' });

    mockWs.receive({
      t: 'paired',
      framework: 'hermes',
      agentName: 'My Agent',
      agentVersion: '2.1',
      sessionToken: 'durable-token',
    });
    await expect(promise).resolves.toMatchObject({ sessionToken: 'durable-token' });
  });
});

describe('chat()', () => {
  it('keeps a server-owned turn alive and yields operational activity', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);

    const events: object[] = [];
    const collecting = (async () => {
      for await (const ev of client.chat([{ role: 'user', content: 'hi' }], 'req-activity')) {
        events.push(ev);
      }
    })();

    await flush();
    mockWs.openNow();
    await flush();
    mockWs.receive({ t: 'activity', reqId: 'req-activity', label: 'Searching the web…' });
    mockWs.receive({ t: 'done', reqId: 'req-activity' });
    await collecting;

    expect(events).toEqual([
      { type: 'tool', label: 'Searching the web…' },
      { type: 'done' },
    ]);
  });

  it('yields delta events then done', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);

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

  it('carries the connector event id on a settled turn', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const events: object[] = [];
    const collecting = (async () => {
      for await (const ev of client.chat([{ role: 'user', content: 'hi' }], 'req-event')) events.push(ev);
    })();

    await flush();
    mockWs.openNow();
    await flush();
    mockWs.receive({ t: 'chunk', reqId: 'req-event', delta: 'Hello' });
    mockWs.receive({ t: 'done', reqId: 'req-event', eventId: 'event-1' });

    await collecting;
    expect(events[events.length - 1]).toEqual({ type: 'done', eventId: 'event-1' });
  });

  it('carries authoritative final text when the native plugin revises a draft', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const events: object[] = [];
    const collecting = (async () => {
      for await (const ev of client.chat([{ role: 'user', content: 'hi' }], 'req-final')) events.push(ev);
    })();

    await flush();
    mockWs.openNow();
    await flush();
    mockWs.receive({ t: 'chunk', reqId: 'req-final', delta: 'First draft.' });
    mockWs.receive({ t: 'done', reqId: 'req-final', eventId: 'event-final', content: 'Final answer.' });

    await collecting;
    expect(events[events.length - 1]).toEqual({
      type: 'done', eventId: 'event-final', content: 'Final answer.',
    });
  });

  it('yields error event on error frame', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);

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

  it('yields an approval event on approval_req and keeps streaming', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);

    const events: object[] = [];
    const gen = client.chat([{ role: 'user', content: 'deploy' }], 'req-4');
    const collecting = (async () => { for await (const ev of gen) events.push(ev); })();

    await flush();
    mockWs.openNow();
    await flush();

    mockWs.receive({ t: 'chunk', reqId: 'req-4', delta: 'Deploying' });
    // Pushed approvals carry the Gateway approval id, not the chat reqId.
    mockWs.receive({ t: 'approval_req', approvalId: 'ap-1', command: 'make deploy' });
    mockWs.receive({ t: 'chunk', reqId: 'req-4', delta: ' now' });
    mockWs.receive({ t: 'done', reqId: 'req-4' });

    await collecting;
    expect(events).toEqual([
      { type: 'delta', text: 'Deploying' },
      { type: 'approval', runId: 'ap-1', title: 'Run a command', command: 'make deploy' },
      { type: 'delta', text: ' now' },
      { type: 'done' },
    ]);
  });

  it('yields error event on peer_gone', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);

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

  it('detaches without declaring agent failure when only the phone socket closes', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const events: object[] = [];
    const collecting = (async () => {
      for await (const ev of client.chat([{ role: 'user', content: 'hi' }], 'req-away')) events.push(ev);
    })();

    await flush();
    mockWs.openNow();
    await flush();
    mockWs.receive({ t: 'chunk', reqId: 'req-away', delta: 'Partial' });
    mockWs.close();

    await collecting;
    expect(events).toEqual([{ type: 'delta', text: 'Partial' }, { type: 'detached' }]);
  });
});

describe('background reply sync', () => {
  it('collects connector-owned settled replies and acknowledges them', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const syncing = client.syncReplies();
    await flush();
    mockWs.openNow();
    await flush();

    const syncReq = JSON.parse(mockWs.sent[0]);
    expect(syncReq.t).toBe('sync_req');
    const reply = {
      id: 'event-1', reqId: 'req-1', sessionId: 'session-1', status: 'done',
      content: 'Finished while away', createdAt: 123,
    };
    mockWs.receive({ t: 'sync_reply', reqId: syncReq.reqId, reply });
    mockWs.receive({ t: 'sync_done', reqId: syncReq.reqId });
    await expect(syncing).resolves.toEqual([reply]);

    await client.acknowledgeReplies(['event-1']);
    expect(JSON.parse(mockWs.sent[mockWs.sent.length - 1])).toEqual({ t: 'ack_replies', ids: ['event-1'] });
  });
});

describe('resolveApproval()', () => {
  it('sends an approval_resolve frame with the decision', async () => {
    client = new RelayClient('ws://localhost:8787?code=111111');
    markAuthenticated(client);
    const promise = client.resolveApproval('ap-1', 'approve');
    await flush();
    mockWs.openNow();
    await flush();
    await promise;
    expect(JSON.parse(mockWs.sent[0])).toEqual({
      t: 'approval_resolve',
      approvalId: 'ap-1',
      decision: 'approve',
    });
  });
});
