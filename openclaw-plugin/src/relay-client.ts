import WebSocket from 'ws';
import { formatPairingCode } from '../../protocol/pairingCode';
import type { AnyFrame, CodeFrame } from './protocol';
import type { IdentityStore } from './identity';

/**
 * The plugin's outbound connection to Summit's relay.
 *
 * Same wire protocol as the Go connector (protocol/protocol.ts), same
 * reconnect/rotation behaviour — the only difference on the wire is
 * `via: 'plugin'` in the hello, which is what lets the app tell a native
 * install apart from the compatibility connector. Nothing here dials in to us:
 * the socket is outbound-only, so no port is opened on the user's machine.
 */

/** Cloudflare's idle timer resets on JSON messages, not WebSocket control pings. */
const HEARTBEAT_MS = 30_000;
const RECONNECT_MS = 5_000;
/** Ceiling on the redial wait. The relay throttles pairing attempts per IP, so a
 *  connector that redials at a fixed rate can hold its own network over the
 *  limit indefinitely — including the phone trying to pair from it. Backing off
 *  is what lets a refused connector stop being the reason it stays refused. */
const MAX_RECONNECT_MS = 60_000;
/** Floor on the rotation window: a clock skewed past the deadline would
 *  otherwise spin us through codes as fast as we can dial. */
const MIN_ROTATE_MS = 5_000;

export type RelayLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type RelayClientOptions = {
  relayUrl: string;
  agentName: string;
  agentVersion: string;
  identity: IdentityStore;
  logger: RelayLogger;
  /** Every frame the relay forwards from the app. */
  onFrame: (frame: AnyFrame) => void;
  /** Fires when a phone claims the channel, and on reconnect to a paired channel. */
  onPaired?: () => void;
  /** Injected for tests; defaults to the real `ws` client. */
  connect?: (url: string) => WebSocket;
  reconnectMs?: number;
  heartbeatMs?: number;
};

export type RelayClient = {
  start: () => void;
  stop: () => void;
  send: (frame: AnyFrame) => void;
  /** True while a socket is open — callers drop work rather than queue it. */
  isConnected: () => boolean;
};

function buildUrl(relayUrl: string, identity: IdentityStore): string {
  const saved = identity.load();
  if (!saved) return relayUrl;
  const claim = `claim=${encodeURIComponent(saved.code)}`;
  const token = saved.connectorToken ? `&token=${encodeURIComponent(saved.connectorToken)}` : '';
  return `${relayUrl}${relayUrl.includes('?') ? '&' : '?'}${claim}${token}`;
}

export function createRelayClient(options: RelayClientOptions): RelayClient {
  const {
    relayUrl,
    agentName,
    agentVersion,
    identity,
    logger,
    onFrame,
    onPaired,
    connect = (url: string) => new WebSocket(url),
    reconnectMs = RECONNECT_MS,
    heartbeatMs = HEARTBEAT_MS,
  } = options;

  let socket: WebSocket | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  let rotate: NodeJS.Timeout | null = null;
  let reconnect: NodeJS.Timeout | null = null;
  let stopped = false;
  /** Grows while dials keep failing, resets the moment one succeeds. */
  let reconnectDelay = reconnectMs;

  const clearTimers = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (rotate) clearTimeout(rotate);
    heartbeat = null;
    rotate = null;
  };

  const send = (frame: AnyFrame) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(frame));
    } catch (err) {
      logger.warn(`summit: relay send failed: ${String(err)}`);
    }
  };

  const handleCode = (frame: CodeFrame) => {
    identity.save({ code: frame.code, connectorToken: frame.connectorToken });
    if (rotate) {
      clearTimeout(rotate);
      rotate = null;
    }
    if (frame.paired) {
      logger.info('summit: paired with your phone — waiting for messages.');
      onPaired?.();
      return;
    }
    logger.info(
      `summit: pairing code ${formatPairingCode(frame.code)} — enter it in the Summit app. Never share it.`,
    );
    if (!frame.expiresAt) return;
    const wait = Math.max(frame.expiresAt - Date.now(), MIN_ROTATE_MS);
    rotate = setTimeout(() => {
      logger.info('summit: that pairing code expired unused — fetching a fresh one.');
      // Dropping the saved channel and closing sends us back through open(),
      // which dials without a claim and mints a new code.
      identity.clear();
      socket?.close();
    }, wait);
  };

  const open = () => {
    if (stopped) return;
    let ws: WebSocket;
    try {
      ws = connect(buildUrl(relayUrl, identity));
    } catch (err) {
      logger.warn(`summit: relay dial failed: ${String(err)} — retrying in ${reconnectDelay}ms`);
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.on('open', () => {
      logger.info(`summit: connected to relay ${relayUrl}`);
      // Reaching the relay clears the penalty. Code rotation depends on this:
      // it closes a live socket on purpose to fetch a fresh code, and must not
      // be made to crawl by a backoff earned before we ever got through.
      reconnectDelay = reconnectMs;
      // Advertising code_rotation is what earns the short code TTL: we promise
      // to fetch a replacement when it lapses, so the user is never left
      // staring at a dead code.
      send({
        t: 'hello',
        framework: 'openclaw',
        agentName,
        agentVersion,
        via: 'plugin',
        capabilities: ['code_rotation'],
      });
      heartbeat = setInterval(() => send({ t: 'ping' }), heartbeatMs);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      let frame: AnyFrame;
      try {
        frame = JSON.parse(data.toString()) as AnyFrame;
      } catch {
        logger.warn('summit: dropped a malformed relay frame');
        return;
      }
      if (frame.t === 'code') {
        handleCode(frame);
        return;
      }
      if (frame.t === 'pair_ok') {
        if (rotate) {
          clearTimeout(rotate);
          rotate = null;
        }
        logger.info('summit: paired with your phone — waiting for messages.');
        onPaired?.();
        return;
      }
      if (frame.t === 'pong') return;
      onFrame(frame);
    });

    ws.on('error', (err: Error) => {
      logger.warn(`summit: relay socket error: ${err.message}`);
    });

    ws.on('close', () => {
      clearTimers();
      socket = null;
      if (stopped) return;
      logger.info(`summit: relay disconnected — reconnecting in ${reconnectDelay}ms`);
      scheduleReconnect();
    });
  };

  function scheduleReconnect() {
    if (stopped || reconnect) return;
    // Spread over [d, 1.25d). A relay deploy drops every connector's socket at
    // the same instant; without jitter they would all come back at the same
    // instant too, and rebuild the pile-up they are backing off from.
    const wait = reconnectDelay + Math.random() * (reconnectDelay / 4);
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
    reconnect = setTimeout(() => {
      reconnect = null;
      open();
    }, wait);
  }

  return {
    start() {
      stopped = false;
      open();
    },
    stop() {
      stopped = true;
      clearTimers();
      if (reconnect) clearTimeout(reconnect);
      reconnect = null;
      socket?.close();
      socket = null;
    },
    send,
    isConnected: () => socket?.readyState === WebSocket.OPEN,
  };
}
