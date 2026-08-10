import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PairingChannel } from '../channel';
import { makeInitialState } from '../logic';
import type { ChannelState } from '../logic';

const CODE = 'K7M29XQP';

/** Stand-in for DurableObjectState: a Map-backed storage plus the alarm and
 *  socket surface the reaper reads. Enough to drive the lifecycle without the
 *  workerd runtime, in the same hand-rolled style as index.test.ts. */
function makeDoState(initial?: Partial<ChannelState>) {
  const store = new Map<string, unknown>();
  if (initial) store.set('state', { ...makeInitialState(), ...initial });

  let openSockets: { tag: string }[] = [];
  const storage = {
    get: vi.fn(async (key: string) => store.get(key)),
    put: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
    setAlarm: vi.fn(async () => {}),
    deleteAll: vi.fn(async () => void store.clear()),
  };

  // workerd holds every event until blockConcurrencyWhile settles. Nothing here
  // can do that, so hand the promise back and let makeChannel await it — a test
  // that ran alarm() against a half-loaded state would be testing the harness.
  let loaded: Promise<void> = Promise.resolve();

  return {
    storage,
    blockConcurrencyWhile: (fn: () => Promise<void>) => {
      loaded = fn();
      return loaded;
    },
    whenLoaded: () => loaded,
    acceptWebSocket: vi.fn(),
    getWebSockets: (tag?: string) =>
      openSockets
        .filter((s) => tag === undefined || s.tag === tag)
        .map(() => ({ readyState: 1 /* OPEN */ })),
    getTags: () => [],
    /** Test handle: pretend these tagged sockets are live. */
    setOpenSockets(tags: string[]) {
      openSockets = tags.map((tag) => ({ tag }));
    },
    store,
  };
}

async function makeChannel(initial?: Partial<ChannelState>) {
  const doState = makeDoState(initial);
  const channel = new PairingChannel(doState as never, {});
  await doState.whenLoaded();
  doState.storage.setAlarm.mockClear();
  return { channel, doState };
}

function connectorRequest() {
  return new Request(`https://relay.summitapp.dev/?code=${CODE}&role=connector`, {
    headers: { Upgrade: 'websocket' },
  });
}

beforeEach(() => {
  // WebSocketPair / acceptWebSocket are workerd globals; the reaper never reads
  // the sockets they produce, so a minimal stub is enough to get through fetch.
  vi.stubGlobal('WebSocketPair', function WebSocketPairStub(this: unknown) {
    return { 0: { readyState: 1 }, 1: { readyState: 1 } };
  });
  vi.stubGlobal('WebSocket', { OPEN: 1 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('orphaned-channel reaper', () => {
  it('arms the alarm as soon as a connector open persists state', async () => {
    const { channel, doState } = await makeChannel();

    // The 101 response at the end of fetch is a workerd-only construct that
    // Node's Response rejects. Everything under test happens before it.
    await channel.fetch(connectorRequest()).catch((err: Error) => {
      if (!/status/.test(err.message)) throw err;
    });

    // Storage is written before any frame proves who is on the other end, so
    // the expiry has to be set here — `codeExpiresAt` is not set until `hello`.
    expect(doState.storage.put).toHaveBeenCalled();
    expect(doState.storage.setAlarm).toHaveBeenCalledTimes(1);
    const armedFor = doState.storage.setAlarm.mock.calls[0]![0] as number;
    expect(armedFor).toBeGreaterThan(Date.now() + 10 * 60_000);
  });

  it('deletes an unpaired channel that nobody is connected to', async () => {
    const { channel, doState } = await makeChannel({ code: CODE, paired: false });

    await channel.alarm();

    expect(doState.storage.deleteAll).toHaveBeenCalledTimes(1);
    expect(doState.store.size).toBe(0);
  });

  it('never deletes a paired channel — it holds the session and push tokens', async () => {
    const { channel, doState } = await makeChannel({
      code: CODE,
      paired: true,
      sessionToken: 'session',
      pushToken: 'ExponentPushToken[abc]',
    });

    await channel.alarm();

    expect(doState.storage.deleteAll).not.toHaveBeenCalled();
    // And it stops re-arming: there is nothing left to wait for.
    expect(doState.storage.setAlarm).not.toHaveBeenCalled();
  });

  it('waits another window when a connector is still holding the line', async () => {
    const { channel, doState } = await makeChannel({ code: CODE, paired: false });
    // A connector displaying a code while the user walks over to their phone.
    doState.setOpenSockets(['connector']);

    await channel.alarm();

    expect(doState.storage.deleteAll).not.toHaveBeenCalled();
    expect(doState.storage.setAlarm).toHaveBeenCalledTimes(1);
  });

  it('waits another window when an authenticated app socket is attached', async () => {
    const { channel, doState } = await makeChannel({ code: CODE, paired: false });
    doState.setOpenSockets(['authenticated']);

    await channel.alarm();

    expect(doState.storage.deleteAll).not.toHaveBeenCalled();
    expect(doState.storage.setAlarm).toHaveBeenCalledTimes(1);
  });
});
