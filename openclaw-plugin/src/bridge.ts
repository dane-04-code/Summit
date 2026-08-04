import type { PluginRuntime, OpenClawConfig } from 'openclaw/plugin-sdk/channel-core';
import type { ReplyPayload } from 'openclaw/plugin-sdk/reply-payload';
import { CHANNEL_ID } from './config';
import type { AnyFrame, ChatFrame, SettledReply } from './protocol';
import type { ReplyOutbox } from './outbox';
import type { RelayLogger } from './relay-client';

/**
 * Turns relay frames into OpenClaw agent turns and back.
 *
 * This is the part the Go connector cannot do. The connector dials the
 * Gateway's operator WS from outside and re-implements the handshake; running
 * in-process, we hand the message straight to the same inbound pipeline
 * Telegram and Discord use, which means sessions, routing, history, hooks and
 * (later) approvals all behave like a first-class channel instead of an
 * emulation of one.
 */

/** How often a still-running turn reassures the phone that something is happening. */
const ACTIVITY_MS = 15_000;

/** One conversation's in-flight turn. Keyed so an out-of-band send (the agent
 *  messaging the phone on its own) can tell "reply to the open request" from
 *  "nudge them". */
type ActiveTurn = {
  reqId: string;
  sessionId: string | undefined;
  chunks: string[];
};

export type SummitBridge = {
  handleFrame: (frame: AnyFrame) => void;
  /** Outbound path for the shared `message` tool: agent-initiated text to a
   *  Summit conversation. Returns true when it reached the phone somehow. */
  sendToConversation: (conversationId: string, text: string) => boolean;
  stop: () => void;
};

export type SummitBridgeOptions = {
  runtime: PluginRuntime;
  /** Snapshot resolver — config can be hot-reloaded under a long-lived service. */
  getConfig: () => OpenClawConfig;
  accountId?: string;
  agentName: string;
  outbox: ReplyOutbox;
  logger: RelayLogger;
  send: (frame: AnyFrame) => void;
};

/** The app's own session id is the conversation: one Summit thread on the phone
 *  is one OpenClaw session. Older app builds may omit it; `main` keeps those on
 *  the agent's default bucket rather than inventing a stray session per turn. */
function conversationIdFor(frame: ChatFrame): string {
  return frame.sessionKey?.trim() || frame.sessionId?.trim() || 'main';
}

/** The relay hands us the whole messages array; only the newest user turn is
 *  new to the agent — OpenClaw already owns the history for this session. */
function latestUserText(frame: ChatFrame): string {
  for (let i = frame.messages.length - 1; i >= 0; i--) {
    const message = frame.messages[i];
    if (message?.role === 'user' && message.content.trim() !== '') return message.content;
  }
  return '';
}

export function createSummitBridge(options: SummitBridgeOptions): SummitBridge {
  const { runtime, getConfig, accountId, agentName, outbox, logger, send } = options;
  const active = new Map<string, ActiveTurn>();

  const settle = (
    turn: ActiveTurn,
    status: 'done' | 'error',
    error?: string,
  ) => {
    const content = turn.chunks.join('');
    const reply: SettledReply = outbox.add({
      reqId: turn.reqId,
      sessionId: turn.sessionId ?? '',
      status,
      content,
      ...(error ? { error } : {}),
    });
    if (status === 'done') {
      send({ t: 'done', reqId: turn.reqId, sessionId: turn.sessionId, eventId: reply.id, content });
    } else {
      send({
        t: 'error',
        reqId: turn.reqId,
        sessionId: turn.sessionId,
        eventId: reply.id,
        message: error ?? 'The agent failed to answer.',
      });
    }
  };

  const deliverText = (turn: ActiveTurn, text: string) => {
    turn.chunks.push(text);
    send({ t: 'chunk', reqId: turn.reqId, sessionId: turn.sessionId, delta: text });
  };

  async function runTurn(frame: ChatFrame): Promise<void> {
    const conversationId = conversationIdFor(frame);
    const text = latestUserText(frame);
    const turn: ActiveTurn = { reqId: frame.reqId, sessionId: frame.sessionId, chunks: [] };

    if (text === '') {
      settle(turn, 'error', 'Empty message.');
      return;
    }
    if (active.has(conversationId)) {
      // One turn per conversation. The app serializes sends, so this only
      // fires on a resend after a dropped socket — answering the new request
      // with an error is honest and lets the outbox deliver the original.
      settle(turn, 'error', 'That conversation is already waiting on a reply.');
      return;
    }
    active.set(conversationId, turn);

    const heartbeat = setInterval(() => {
      // Phase 3 replaces this with the real tool name from `before_tool_call`.
      send({ t: 'activity', reqId: turn.reqId, sessionId: turn.sessionId, label: 'Thinking…' });
    }, ACTIVITY_MS);

    try {
      const cfg = getConfig();
      const route = runtime.channel.routing.resolveAgentRoute({
        cfg,
        channel: CHANNEL_ID,
        accountId,
        peer: { kind: 'direct', id: conversationId },
      });
      const storePath = runtime.agent.session.resolveStorePath(undefined, { agentId: route.agentId });

      await runtime.channel.inbound.run({
        channel: CHANNEL_ID,
        accountId,
        raw: frame,
        adapter: {
          ingest: () => ({ id: frame.reqId, timestamp: Date.now(), rawText: text, raw: frame }),
          resolveTurn: (input) => ({
            cfg,
            channel: CHANNEL_ID,
            accountId,
            agentId: route.agentId,
            routeSessionKey: route.sessionKey,
            storePath,
            ctxPayload: runtime.channel.inbound.buildContext({
              channel: CHANNEL_ID,
              accountId,
              messageId: input.id,
              timestamp: input.timestamp,
              // The relay only forwards app frames on an authenticated socket,
              // so every inbound here is the one paired operator by
              // construction — there is no second sender to distinguish.
              from: 'summit:operator',
              sender: { id: 'summit:operator', name: 'Summit', displayLabel: 'Summit' },
              conversation: { kind: 'direct', id: conversationId },
              route: { agentId: route.agentId, accountId: route.accountId, routeSessionKey: route.sessionKey },
              reply: { to: conversationId },
              message: { rawBody: input.rawText },
            }),
            recordInboundSession: runtime.channel.session.recordInboundSession,
            dispatchReplyWithBufferedBlockDispatcher:
              runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher,
            delivery: {
              deliver: async (payload: ReplyPayload) => {
                if (payload.text) deliverText(turn, payload.text);
              },
            },
          }),
        },
      });
      settle(turn, 'done');
    } catch (err) {
      logger.error(`summit: turn failed: ${String(err)}`);
      settle(turn, 'error', err instanceof Error ? err.message : String(err));
    } finally {
      clearInterval(heartbeat);
      active.delete(conversationId);
    }
  }

  return {
    handleFrame(frame) {
      switch (frame.t) {
        case 'chat':
          void runTurn(frame);
          return;
        case 'sync_req': {
          for (const reply of outbox.list()) {
            send({ t: 'sync_reply', reqId: frame.reqId, reply });
          }
          send({ t: 'sync_done', reqId: frame.reqId });
          return;
        }
        case 'ack_replies':
          outbox.ack(frame.ids);
          return;
        case 'peer_gone':
          logger.info('summit: app disconnected — waiting for reconnect.');
          return;
        default:
          // api_req / approval_resolve / models_req land here until the phases
          // that own them. Staying quiet beats answering with a wrong shape.
          logger.warn(`summit: ignoring unsupported frame "${frame.t}"`);
      }
    },

    sendToConversation(conversationId, text) {
      const turn = active.get(conversationId);
      if (turn) {
        deliverText(turn, text);
        return true;
      }
      // Nothing is waiting on this text, so it is a nudge, not a reply. The
      // relay pushes it to the phone when the app is away and forwards it
      // in-band when it isn't.
      send({ t: 'notify', title: agentName, body: text });
      return true;
    },

    stop() {
      active.clear();
    },
  };
}
