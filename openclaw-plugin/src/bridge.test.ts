import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PluginRuntime, OpenClawConfig } from 'openclaw/plugin-sdk/channel-core';
import { createSummitBridge } from './bridge';
import { createReplyOutbox } from './outbox';
import type { AnyFrame, ChatFrame } from './protocol';
import type { RelayLogger } from './relay-client';

/**
 * A stand-in for the in-process OpenClaw runtime.
 *
 * The point of these tests is the seam we own: relay frame in, correct inbound
 * facts handed to OpenClaw's pipeline, correct frames back out. Whether the
 * pipeline itself answers well is the Gateway's job and is what live
 * validation against a real Gateway is for — a fake cannot prove that and
 * should not pretend to.
 */
function fakeRuntime(replies: string[][], opts: { fail?: Error } = {}) {
  const seen: { assembled?: Record<string, unknown>; input?: Record<string, unknown> } = {};

  const runtime = {
    version: '2026.6.11',
    config: { current: () => ({}) as OpenClawConfig },
    agent: { session: { resolveStorePath: () => '/tmp/sessions.json' } },
    channel: {
      routing: {
        resolveAgentRoute: (params: { peer?: { id: string } | null }) => ({
          agentId: 'main',
          channel: 'summit',
          accountId: 'default',
          sessionKey: `agent:main:summit:${params.peer?.id}`,
          mainSessionKey: 'agent:main',
          lastRoutePolicy: 'session',
          matchedBy: 'default',
        }),
      },
      session: { recordInboundSession: vi.fn() },
      reply: { dispatchReplyWithBufferedBlockDispatcher: vi.fn() },
      inbound: {
        buildContext: (facts: Record<string, unknown>) => ({ ...facts, built: true }),
        async run({ raw, adapter }: { raw: unknown; adapter: Record<string, any> }) {
          const input = await adapter.ingest(raw);
          seen.input = input;
          const assembled = await adapter.resolveTurn(
            input,
            { kind: 'message', canStartAgentTurn: true },
            {},
          );
          seen.assembled = assembled;
          if (opts.fail) throw opts.fail;
          for (const batch of replies) {
            for (const text of batch) {
              await assembled.delivery.deliver({ text }, { kind: 'final' });
            }
          }
          return { admission: { kind: 'dispatch' }, dispatched: true };
        },
      },
    },
  };

  return { runtime: runtime as unknown as PluginRuntime, seen };
}

const dirs: string[] = [];
function newOutbox() {
  const dir = mkdtempSync(join(tmpdir(), 'summit-bridge-'));
  dirs.push(dir);
  return createReplyOutbox(join(dir, 'reply_outbox.json'));
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const silentLogger: RelayLogger = { info: () => {}, warn: () => {}, error: () => {} };

function makeBridge(runtime: PluginRuntime) {
  const sent: AnyFrame[] = [];
  const bridge = createSummitBridge({
    runtime,
    getConfig: () => ({}) as OpenClawConfig,
    agentName: 'OpenClaw',
    outbox: newOutbox(),
    logger: silentLogger,
    send: (frame) => sent.push(frame),
  });
  return { bridge, sent };
}

const chat = (over: Partial<ChatFrame> = {}): ChatFrame => ({
  t: 'chat',
  reqId: 'r1',
  sessionId: 'sess-1',
  messages: [{ role: 'user', content: 'what is up' }],
  ...over,
});

/** The bridge dispatches turns without awaiting; drain the microtask queue. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('chat round-trip', () => {
  it('streams each delivered block as a chunk and closes with done', async () => {
    const { runtime } = fakeRuntime([['Hello ', 'world.']]);
    const { bridge, sent } = makeBridge(runtime);

    bridge.handleFrame(chat());
    await settle();

    expect(sent.map((f) => f.t)).toEqual(['chunk', 'chunk', 'done']);
    expect(sent.filter((f) => f.t === 'chunk').map((f: any) => f.delta)).toEqual(['Hello ', 'world.']);
    const done: any = sent.at(-1);
    // `content` is the authoritative final text so the app never has to
    // reassemble chunks it may have missed across a reconnect.
    expect(done.content).toBe('Hello world.');
    expect(done.reqId).toBe('r1');
    expect(done.sessionId).toBe('sess-1');
    expect(done.eventId).toBeTruthy();
  });

  it('routes the turn through the app session so one thread is one session', async () => {
    const { runtime, seen } = fakeRuntime([['ok']]);
    const { bridge } = makeBridge(runtime);

    bridge.handleFrame(chat({ sessionKey: 'thread-7' }));
    await settle();

    expect(seen.assembled?.routeSessionKey).toBe('agent:main:summit:thread-7');
    const ctx = seen.assembled?.ctxPayload as Record<string, any>;
    expect(ctx.conversation).toEqual({ kind: 'direct', id: 'thread-7' });
    expect(ctx.reply).toEqual({ to: 'thread-7' });
  });

  it('falls back to the agent main bucket when the app sends no session', async () => {
    const { runtime, seen } = fakeRuntime([['ok']]);
    const { bridge } = makeBridge(runtime);

    bridge.handleFrame(chat({ sessionId: undefined }));
    await settle();

    expect(seen.assembled?.routeSessionKey).toBe('agent:main:summit:main');
  });

  it('sends only the newest user turn — OpenClaw already owns the history', async () => {
    const { runtime, seen } = fakeRuntime([['ok']]);
    const { bridge } = makeBridge(runtime);

    bridge.handleFrame(
      chat({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'second' },
        ],
      }),
    );
    await settle();

    expect(seen.input?.rawText).toBe('second');
  });

  it('reports a failed turn as an error frame rather than hanging the app', async () => {
    const { runtime } = fakeRuntime([], { fail: new Error('model unavailable') });
    const { bridge, sent } = makeBridge(runtime);

    bridge.handleFrame(chat());
    await settle();

    const error: any = sent.at(-1);
    expect(error.t).toBe('error');
    expect(error.message).toBe('model unavailable');
    expect(error.reqId).toBe('r1');
  });

  it('rejects a second turn for a conversation that is still answering', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { runtime } = fakeRuntime([['ok']]);
    const slow = {
      ...runtime,
      channel: {
        ...runtime.channel,
        inbound: {
          ...runtime.channel.inbound,
          run: async (params: any) => {
            await gate;
            return runtime.channel.inbound.run(params);
          },
        },
      },
    } as unknown as PluginRuntime;
    const { bridge, sent } = makeBridge(slow);

    bridge.handleFrame(chat({ reqId: 'r1' }));
    await settle();
    bridge.handleFrame(chat({ reqId: 'r2' }));
    await settle();

    const second: any = sent.find((f: any) => f.reqId === 'r2');
    expect(second.t).toBe('error');
    release();
    await settle();
  });
});

describe('offline recovery', () => {
  it('answers sync_req from the outbox and forgets what the app acknowledges', async () => {
    const { runtime } = fakeRuntime([['answer']]);
    const { bridge, sent } = makeBridge(runtime);

    bridge.handleFrame(chat());
    await settle();
    const eventId = (sent.at(-1) as any).eventId as string;
    sent.length = 0;

    bridge.handleFrame({ t: 'sync_req', reqId: 'sync-1' });
    expect(sent.map((f) => f.t)).toEqual(['sync_reply', 'sync_done']);
    expect((sent[0] as any).reply.content).toBe('answer');

    bridge.handleFrame({ t: 'ack_replies', ids: [eventId] });
    sent.length = 0;
    bridge.handleFrame({ t: 'sync_req', reqId: 'sync-2' });
    expect(sent.map((f) => f.t)).toEqual(['sync_done']);
  });
});

describe('agent-initiated sends', () => {
  it('folds into the open turn when one is running', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { runtime } = fakeRuntime([]);
    const slow = {
      ...runtime,
      channel: {
        ...runtime.channel,
        inbound: {
          ...runtime.channel.inbound,
          run: async (params: any) => {
            const result = await runtime.channel.inbound.run(params);
            await gate;
            return result;
          },
        },
      },
    } as unknown as PluginRuntime;
    const { bridge, sent } = makeBridge(slow);

    bridge.handleFrame(chat({ sessionKey: 'thread-7' }));
    await settle();
    bridge.sendToConversation('thread-7', 'side note');

    expect(sent.some((f: any) => f.t === 'chunk' && f.delta === 'side note')).toBe(true);
    release();
    await settle();
  });

  it('becomes a nudge when nothing is waiting on it', () => {
    const { runtime } = fakeRuntime([]);
    const { bridge, sent } = makeBridge(runtime);

    bridge.sendToConversation('thread-7', 'your build finished');

    // No reqId exists to attach this to, so it goes out as a notification the
    // relay can push when the app is closed.
    expect(sent).toEqual([{ t: 'notify', title: 'OpenClaw', body: 'your build finished' }]);
  });
});
