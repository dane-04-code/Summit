import {
  makeInitialState,
  handleConnectorOpen,
  handleAppOpen,
  handleConnectorMessage,
  handleAppMessage,
  handleConnectorClose,
  handleAppClose,
  credentialMatches,
} from './logic';
import type { ChannelState, SideEffect } from './logic';
import type { AnyFrame } from '../../protocol/protocol';

/** Only the env this DO reads — kept local to avoid a cycle with index.ts. */
type ChannelEnv = { PUSH_URL?: string };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_FRAME_BYTES = 1024 * 1024;
const APP_FRAME_TYPES = new Set([
  'ping', 'pair', 'resume', 'register_push', 'chat', 'sync_req', 'ack_replies', 'api_req', 'approval_resolve',
  'models_req', 'model_select',
]);
/** Relay-authored connector frames. Undeliverable ones are dropped rather than
 *  reported to the app: the app never asked for them, so surfacing "agent is
 *  offline" for one would raise a spurious error on an otherwise fine pair. */
const RELAY_ORIGINATED = new Set(['pair_ok', 'code', 'peer_gone']);
const CONNECTOR_FRAME_TYPES = new Set([
  'hello', 'ping', 'notify', 'chunk', 'activity', 'done', 'error', 'sync_reply', 'sync_done', 'api_res', 'approval_req',
  'models', 'model_result',
]);

export class PairingChannel {
  private state: ChannelState = makeInitialState();

  constructor(
    private readonly doState: DurableObjectState,
    private readonly env: ChannelEnv = {},
  ) {
    // Reload persisted state on every wake — the DO hibernates between messages
    // and loses all in-memory state. Without this, connectorInfo is always null
    // when the app sends its pair frame.
    this.doState.blockConcurrencyWhile(async () => {
      const stored = await this.doState.storage.get<ChannelState>('state');
      if (stored) this.state = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role') as 'connector' | 'app';
    const code = url.searchParams.get('code')!;
    const token = url.searchParams.get('token');

    // Cloudflare disconnects all Durable Object WebSockets on deploy, but our
    // storage survives. Reconcile the cached presence flags before making an
    // admission decision so a valid connector cannot be locked out by a stale
    // `connectorConnected: true` snapshot after an update or runtime restart.
    await this.reconcilePresence();

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    if (role === 'connector') {
      if (this.state.connectorToken && !credentialMatches(this.state.connectorToken, token)) {
        return new Response('Connector authentication required', { status: 401 });
      }
      const result = handleConnectorOpen(this.state, code, this.hasOpenSocket('connector'));
      if (result.occupied) return new Response('Already occupied', { status: 409 });
      this.state = result.state;
      await this.doState.storage.put('state', this.state);
      this.doState.acceptWebSocket(server, ['connector']);
    } else {
      const authenticated = credentialMatches(this.state.sessionToken, token);
      // Presence gates pushes: while an app socket is attached, agent events
      // stay in-band; the moment it detaches, finished turns become pushes.
      if (authenticated) {
        this.state = handleAppOpen(this.state);
        await this.doState.storage.put('state', this.state);
      }
      this.doState.acceptWebSocket(server, ['app', authenticated ? 'authenticated' : 'unauthenticated']);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);
    if (new TextEncoder().encode(raw).byteLength > MAX_FRAME_BYTES) {
      ws.close(1009, 'Frame too large');
      return;
    }
    let frame: AnyFrame;
    try {
      const parsed = JSON.parse(raw) as { t?: unknown };
      if (!parsed || typeof parsed !== 'object' || typeof parsed.t !== 'string') throw new Error('Invalid frame');
      frame = parsed as AnyFrame;
    } catch {
      ws.close(1003, 'Invalid frame');
      return;
    }
    const tags = this.doState.getTags(ws);
    const role = tags[0] as 'connector' | 'app';
    const allowed = role === 'connector' ? CONNECTOR_FRAME_TYPES : APP_FRAME_TYPES;
    if (!allowed.has(frame.t)) {
      ws.close(1008, 'Frame not allowed for this connection');
      return;
    }

    const result = role === 'connector'
      ? handleConnectorMessage(this.state, frame)
      : handleAppMessage(this.state, frame, {}, tags[1] === 'authenticated');

    if (result.state !== this.state) {
      this.state = result.state;
      await this.doState.storage.put('state', this.state);
    }
    await this.dispatch(result.effects);
  }

  async webSocketClose(ws: WebSocket, code = 1000, reason = ''): Promise<void> {
    // This Worker predates Cloudflare's automatic close-response compatibility
    // flag, so explicitly complete the close handshake.
    try {
      ws.close(code, reason);
    } catch {
      // The runtime may already have completed the close.
    }
    await this.handleSocketEnd(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'WebSocket transport error');
    } catch {
      // Cleanup below is still required when the transport is already gone.
    }
    await this.handleSocketEnd(ws);
  }

  private async handleSocketEnd(ws: WebSocket): Promise<void> {
    const tags = this.doState.getTags(ws);
    const role = tags[0] as 'connector' | 'app';
    if (role === 'app' && tags[1] !== 'authenticated') return;

    // A late close/error from an older socket must not mark a replacement
    // offline. It is also safe for webSocketError and webSocketClose to both
    // arrive: once the presence flag is false, cleanup is a no-op.
    const presenceKey = role === 'connector' ? 'connectorConnected' : 'appConnected';
    const liveTag = role === 'connector' ? 'connector' : 'authenticated';
    if (this.hasOpenSocket(liveTag, ws) || !this.state[presenceKey]) return;

    const result = role === 'connector'
      ? handleConnectorClose(this.state)
      : handleAppClose(this.state);
    this.state = result.state;
    await this.doState.storage.put('state', this.state);
    await this.dispatch(result.effects);
  }

  private hasOpenSocket(tag: string, excluding?: WebSocket): boolean {
    return this.doState.getWebSockets(tag).some(
      (socket) => socket !== excluding && socket.readyState === WebSocket.OPEN,
    );
  }

  private async reconcilePresence(): Promise<void> {
    const connectorConnected = this.hasOpenSocket('connector');
    const appConnected = this.hasOpenSocket('authenticated');
    if (
      connectorConnected === this.state.connectorConnected
      && appConnected === this.state.appConnected
    ) return;

    this.state = { ...this.state, connectorConnected, appConnected };
    await this.doState.storage.put('state', this.state);
  }

  private async dispatch(effects: SideEffect[]): Promise<void> {
    const sockets = this.doState.getWebSockets();
    for (const effect of effects) {
      if (effect.to === 'push') {
        await this.sendPush(effect.token, effect.title, effect.body, effect.data);
        continue;
      }
      const target = sockets.find((s) => this.doState.getTags(s)[0] === effect.to);
      if (target) {
        target.send(JSON.stringify(effect.frame));
      } else if (effect.to === 'connector' && !RELAY_ORIGINATED.has(effect.frame.t)) {
        // Connector is not connected — tell the app rather than silently dropping.
        const app = sockets.find((s) => this.doState.getTags(s)[0] === 'app');
        const reqId = (effect.frame as Record<string, unknown>).reqId as string | undefined;
        app?.send(JSON.stringify({ t: 'error', reqId, message: 'Agent is offline. Tap Retry in the app to reconnect.' }));
      }
    }
  }

  /**
   * One notification through the Expo Push API — a plain POST, no APNs/FCM
   * credentials here (EAS holds those for the app build). Failures are logged,
   * never fatal: a lost push must not break the relay session.
   */
  private async sendPush(
    token: string,
    title: string,
    body: string,
    data?: { sessionId?: string },
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(this.env.PUSH_URL || EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: token, title, body, sound: 'default', ...(data ? { data } : {}) }),
        signal: controller.signal,
      });
      if (!res.ok) console.warn(`push send failed: ${res.status}`);
    } catch (err) {
      console.warn('push send failed', err);
    } finally {
      clearTimeout(timeout);
    }
  }
}
