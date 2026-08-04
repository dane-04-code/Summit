import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type WebSocket from 'ws';
import type { AnyFrame, HelloFrame } from './protocol';
import type { IdentityStore, RelayIdentity } from './identity';
import { createRelayClient, type RelayLogger } from './relay-client';

/** Minimal stand-in for the `ws` client: enough surface for the code under test,
 *  and a handle for the test to drive both directions of the socket. */
class FakeSocket extends EventEmitter {
  readyState = 1; // WebSocket.OPEN
  sent: AnyFrame[] = [];
  closed = false;

  send(raw: string) {
    this.sent.push(JSON.parse(raw) as AnyFrame);
  }

  close() {
    this.closed = true;
    this.readyState = 3; // CLOSED
    this.emit('close');
  }

  /** Simulate a frame arriving from the relay. */
  receive(frame: AnyFrame) {
    this.emit('message', Buffer.from(JSON.stringify(frame)));
  }
}

function memoryIdentity(initial: RelayIdentity | null = null): IdentityStore & { current: () => RelayIdentity | null } {
  let saved = initial;
  return {
    load: () => saved,
    save: (identity) => {
      saved = identity;
    },
    clear: () => {
      saved = null;
    },
    current: () => saved,
  };
}

const silentLogger: RelayLogger = { info: () => {}, warn: () => {}, error: () => {} };

let sockets: FakeSocket[];
let urls: string[];

function makeClient(identity: IdentityStore, onFrame = vi.fn(), relayUrl = 'ws://relay.test') {
  sockets = [];
  urls = [];
  const client = createRelayClient({
    relayUrl,
    agentName: 'OpenClaw',
    agentVersion: '2026.6.11',
    identity,
    logger: silentLogger,
    onFrame,
    connect: (url) => {
      urls.push(url);
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
  });
  return { client, onFrame };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('relay client handshake', () => {
  it('announces itself as a native plugin, not the connector', () => {
    const { client } = makeClient(memoryIdentity());
    client.start();
    sockets[0]!.emit('open');

    const hello = sockets[0]!.sent[0] as HelloFrame;
    expect(hello.t).toBe('hello');
    // This is the whole point of Phase 1: the app already keys off `via` to
    // tell a native install apart from the compatibility connector.
    expect(hello.via).toBe('plugin');
    expect(hello.framework).toBe('openclaw');
    expect(hello.capabilities).toContain('code_rotation');
  });

  it('dials clean the first time and reclaims its channel afterwards', () => {
    const identity = memoryIdentity();
    const { client } = makeClient(identity);
    client.start();
    expect(urls[0]).toBe('ws://relay.test');

    sockets[0]!.emit('open');
    sockets[0]!.receive({ t: 'code', code: 'K7M29XQP', connectorToken: 'tok-123' });
    expect(identity.current()).toEqual({ code: 'K7M29XQP', connectorToken: 'tok-123' });

    sockets[0]!.close();
    vi.advanceTimersByTime(5_000);
    expect(urls[1]).toBe('ws://relay.test?claim=K7M29XQP&token=tok-123');
  });

  it('keeps the connection warm with application-level pings', () => {
    const { client } = makeClient(memoryIdentity());
    client.start();
    sockets[0]!.emit('open');
    sockets[0]!.sent.length = 0;

    vi.advanceTimersByTime(30_000);
    expect(sockets[0]!.sent).toEqual([{ t: 'ping' }]);
  });

  it('rotates an unclaimed code by dropping the channel and redialling clean', () => {
    const identity = memoryIdentity();
    const { client } = makeClient(identity);
    client.start();
    sockets[0]!.emit('open');
    sockets[0]!.receive({
      t: 'code',
      code: 'K7M29XQP',
      connectorToken: 'tok-123',
      expiresAt: Date.now() + 180_000,
    });

    vi.advanceTimersByTime(180_000);
    expect(identity.current()).toBeNull();
    expect(sockets[0]!.closed).toBe(true);

    vi.advanceTimersByTime(5_000);
    // No claim: the expired code is gone, so the relay mints a fresh one.
    expect(urls[1]).toBe('ws://relay.test');
  });

  it('stops rotating once a phone claims the channel', () => {
    const identity = memoryIdentity();
    const onPaired = vi.fn();
    sockets = [];
    urls = [];
    const client = createRelayClient({
      relayUrl: 'ws://relay.test',
      agentName: 'OpenClaw',
      agentVersion: '1',
      identity,
      logger: silentLogger,
      onFrame: vi.fn(),
      onPaired,
      connect: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    client.start();
    sockets[0]!.emit('open');
    sockets[0]!.receive({
      t: 'code',
      code: 'K7M29XQP',
      connectorToken: 'tok',
      expiresAt: Date.now() + 60_000,
    });
    sockets[0]!.receive({ t: 'pair_ok' });

    vi.advanceTimersByTime(120_000);
    expect(onPaired).toHaveBeenCalledOnce();
    // The code is spent, not expired — clearing it here would strand the pair.
    expect(identity.current()).toEqual({ code: 'K7M29XQP', connectorToken: 'tok' });
    expect(sockets[0]!.closed).toBe(false);
  });
});

describe('relay client frame routing', () => {
  it('forwards app frames and swallows the ones it answers itself', () => {
    const { client, onFrame } = makeClient(memoryIdentity());
    client.start();
    sockets[0]!.emit('open');

    sockets[0]!.receive({ t: 'pong' });
    sockets[0]!.receive({ t: 'code', code: 'K7M29XQP', connectorToken: 't' });
    sockets[0]!.receive({ t: 'pair_ok' });
    expect(onFrame).not.toHaveBeenCalled();

    const chat: AnyFrame = { t: 'chat', reqId: 'r1', messages: [{ role: 'user', content: 'hi' }] };
    sockets[0]!.receive(chat);
    expect(onFrame).toHaveBeenCalledWith(chat);
  });

  it('drops a malformed frame instead of tearing down the socket', () => {
    const { client, onFrame } = makeClient(memoryIdentity());
    client.start();
    sockets[0]!.emit('open');

    sockets[0]!.emit('message', Buffer.from('{not json'));
    expect(onFrame).not.toHaveBeenCalled();
    expect(sockets[0]!.closed).toBe(false);
  });

  it('stops reconnecting once stopped', () => {
    const { client } = makeClient(memoryIdentity());
    client.start();
    sockets[0]!.emit('open');
    client.stop();

    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });
});
