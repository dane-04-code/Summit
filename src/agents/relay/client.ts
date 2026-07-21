import type { AnyFrame, ChatMessage, NotificationMode, PairErrorFrame, SettledReply } from './types';
import type { ConnectionState, StreamEvent } from '../adapters/types';
import { RelayError, type RelayErrorCode } from './errors';

const PAIR_ERROR_CODE: Record<PairErrorFrame['reason'], RelayErrorCode> = {
  not_found: 'code_not_found',
  expired: 'code_expired',
  already_paired: 'already_paired',
  locked: 'code_locked',
};

export type RelayAgentInfo = { framework: string; agentName: string; agentVersion: string; sessionToken: string };

export class RelayClient {
  private ws: WebSocket | null = null;
  private opening: Promise<WebSocket> | null = null;
  private handlers: ((frame: AnyFrame) => void)[] = [];
  private notificationHandlers: (() => void)[] = [];
  private stateHandlers: ((state: ConnectionState) => void)[] = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pairCode: string | null = null;
  private resumeToken: string | null = null;
  private paired = false;
  private state: ConnectionState = 'unknown';

  constructor(private readonly wsUrl: string) {}

  getConnectionState(): ConnectionState {
    return this.state;
  }

  subscribeConnectionState(listener: (state: ConnectionState) => void): () => void {
    this.stateHandlers.push(listener);
    listener(this.state);
    return () => {
      this.stateHandlers = this.stateHandlers.filter((h) => h !== listener);
    };
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    this.state = state;
    for (const h of this.stateHandlers) h(state);
  }

  private connect(): Promise<WebSocket> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve(this.ws);
    if (this.opening) return this.opening;

    this.setState(this.paired ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    this.opening = new Promise((resolve, reject) => {
      ws.onopen = () => {
        this.opening = null;
        this.startHeartbeat();
        resolve(ws);
      };
      ws.onerror = () => {
        this.opening = null;
        this.setState('disconnected');
        reject(new RelayError('relay_unreachable'));
      };
      ws.onclose = () => {
        this.opening = null;
        this.stopHeartbeat();
        this.paired = false;
        if (this.ws === ws) this.ws = null;
        this.setState('disconnected');
        // Only wins the opening promise if the socket closed before it opened —
        // i.e. we never reached the relay. A mid-session drop settles this reject
        // as a no-op and instead reaches live handlers via socket_closed below.
        reject(new RelayError('relay_unreachable'));
        for (const h of this.handlers) h({ t: 'socket_closed' });
      };
      ws.onmessage = (e) => {
        const frame = JSON.parse(e.data as string) as AnyFrame;
        // Track connector liveness at the socket level so `chat()` re-pairs
        // correctly even when no handler is registered (idle app).
        if (frame.t === 'peer_gone') {
          this.paired = false;
          this.setState('disconnected');
        }
        if (frame.t === 'notify') {
          for (const handler of this.notificationHandlers) handler();
        }
        for (const h of this.handlers) h(frame);
      };
    });
    return this.opening;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ t: 'ping' }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  async pair(code: string): Promise<RelayAgentInfo> {
    this.pairCode = code;
    const ws = await this.connect();

    return new Promise((resolve, reject) => {
      const handler = (frame: AnyFrame) => {
        if (frame.t === 'paired') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          this.paired = true;
          this.setState('connected');
          resolve({
            framework: frame.framework,
            agentName: frame.agentName,
            agentVersion: frame.agentVersion,
            sessionToken: frame.sessionToken,
          });
        } else if (frame.t === 'pair_error') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          this.setState(frame.reason === 'expired' ? 'pairing_expired' : 'disconnected');
          reject(new RelayError(PAIR_ERROR_CODE[frame.reason]));
        } else if (frame.t === 'peer_gone') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          this.setState('disconnected');
          reject(new RelayError('agent_disconnected'));
        } else if (frame.t === 'socket_closed') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          this.setState('disconnected');
          reject(new RelayError('relay_unreachable'));
        }
      };
      this.handlers.push(handler);
      ws.send(JSON.stringify({ t: 'pair', code }));
    });
  }

  async resume(token: string): Promise<RelayAgentInfo> {
    this.resumeToken = token;
    const ws = await this.connect();
    return new Promise((resolve, reject) => {
      const handler = (frame: AnyFrame) => {
        if (frame.t === 'paired') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          this.paired = true;
          this.setState('connected');
          resolve({
            framework: frame.framework,
            agentName: frame.agentName,
            agentVersion: frame.agentVersion,
            sessionToken: frame.sessionToken,
          });
        } else if (frame.t === 'pair_error' || frame.t === 'peer_gone' || frame.t === 'socket_closed') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          this.setState('disconnected');
          reject(new RelayError('agent_disconnected'));
        }
      };
      this.handlers.push(handler);
      ws.send(JSON.stringify({ t: 'resume', token }));
    });
  }

  private async authenticate(): Promise<void> {
    if (this.paired) return;
    if (this.resumeToken) {
      await this.resume(this.resumeToken);
    } else if (this.pairCode) {
      await this.pair(this.pairCode);
    } else {
      throw new Error('Relay authentication required. Pair this agent again.');
    }
  }

  /**
   * Store this device's Expo push token in the pairing channel so the relay
   * can reach the phone when the app is away. Idempotent — safe on every
   * (re)connect.
   */
  async registerPush(token: string | null, mode: NotificationMode): Promise<void> {
    await this.authenticate();
    const ws = await this.connect();
    ws.send(JSON.stringify({ t: 'register_push', ...(token ? { token } : {}), mode }));
  }

  /** Subscribe to a content-free host signal that a durable reply is ready. */
  subscribeNotifications(listener: () => void): () => void {
    this.notificationHandlers.push(listener);
    return () => {
      this.notificationHandlers = this.notificationHandlers.filter((handler) => handler !== listener);
    };
  }

  async *chat(messages: ChatMessage[], reqId: string, sessionId?: string, sessionKey?: string): AsyncIterable<StreamEvent> {
    await this.authenticate();
    const ws = await this.connect();
    ws.send(JSON.stringify({ t: 'chat', reqId, messages, sessionId, sessionKey }));

    const queue: StreamEvent[] = [];
    let notify: (() => void) | null = null;
    let done = false;

    const handler = (frame: AnyFrame) => {
      if (frame.t === 'chunk' && frame.reqId === reqId) {
        queue.push({ type: 'delta', text: frame.delta });
      } else if (frame.t === 'activity' && frame.reqId === reqId) {
        const label = typeof frame.label === 'string' ? frame.label.trim().slice(0, 80) : '';
        if (label) queue.push({ type: 'tool', label });
      } else if (frame.t === 'approval_req') {
        // Pushed exec approval — not tied to the chat reqId; the card resolves
        // it through resolveApproval() with the Gateway approval id as runId.
        queue.push({ type: 'approval', runId: frame.approvalId, title: 'Run a command', command: frame.command });
      } else if (frame.t === 'done' && frame.reqId === reqId) {
        queue.push({
          type: 'done',
          ...(frame.eventId ? { eventId: frame.eventId } : {}),
          ...(typeof frame.content === 'string' ? { content: frame.content } : {}),
        });
        done = true;
      } else if (frame.t === 'error' && (!frame.reqId || frame.reqId === reqId)) {
        queue.push({ type: 'error', message: frame.message, ...(frame.eventId ? { eventId: frame.eventId } : {}) });
        done = true;
      } else if (frame.t === 'peer_gone') {
        this.setState('disconnected');
        queue.push({ type: 'error', message: 'Agent disconnected.' });
        done = true;
      } else if (frame.t === 'socket_closed') {
        this.setState('disconnected');
        queue.push({ type: 'detached' });
        done = true;
      } else {
        return;
      }
      notify?.();
      notify = null;
    };
    this.handlers.push(handler);

    try {
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((r) => { notify = r; });
        }
        while (queue.length > 0) yield queue.shift()!;
      }
    } finally {
      this.handlers = this.handlers.filter((h) => h !== handler);
    }
  }

  /** Fetch settled turns the connector completed while the app was suspended. */
  async syncReplies(): Promise<SettledReply[]> {
    await this.authenticate();
    const ws = await this.connect();
    const reqId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const replies: SettledReply[] = [];

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.handlers = this.handlers.filter((h) => h !== handler);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The agent did not finish syncing in time.'));
      }, 15000);
      const handler = (frame: AnyFrame) => {
        if (frame.t === 'sync_reply' && frame.reqId === reqId) {
          replies.push(frame.reply);
        } else if (frame.t === 'sync_done' && frame.reqId === reqId) {
          cleanup();
          resolve(replies);
        } else if (frame.t === 'error' && frame.reqId === reqId) {
          cleanup();
          reject(new Error(frame.message));
        } else if (frame.t === 'peer_gone') {
          cleanup();
          reject(new Error('Agent disconnected.'));
        } else if (frame.t === 'socket_closed') {
          cleanup();
          reject(new Error('Relay connection closed.'));
        }
      };
      this.handlers.push(handler);
      ws.send(JSON.stringify({ t: 'sync_req', reqId }));
    });
  }

  /** Remove replies only after SQLite has accepted them. Safe to repeat. */
  async acknowledgeReplies(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.authenticate();
    const ws = await this.connect();
    ws.send(JSON.stringify({ t: 'ack_replies', ids }));
  }

  /** Answer a pushed approval. Fire-and-forget: the connector resolves it on
   * the Gateway; the suspended run continues (or is denied) from there. */
  async resolveApproval(approvalId: string, decision: 'approve' | 'deny'): Promise<void> {
    await this.authenticate();
    const ws = await this.connect();
    ws.send(JSON.stringify({ t: 'approval_resolve', approvalId, decision }));
  }

  /**
   * One request/response round-trip over the relay — the connector proxies it
   * to an allow-listed Hermes REST endpoint and replies with `api_res`. Unlike
   * `chat`, this resolves once with the full body. `body` is serialized to JSON.
   */
  async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: string }> {
    await this.authenticate();
    const ws = await this.connect();
    const reqId = `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.handlers = this.handlers.filter((h) => h !== handler);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The agent did not respond in time.'));
      }, 15000);
      const handler = (frame: AnyFrame) => {
        if (frame.t === 'api_res' && frame.reqId === reqId) {
          cleanup();
          resolve({ status: frame.status, body: frame.body });
        } else if (frame.t === 'error' && frame.reqId === reqId) {
          cleanup();
          reject(new Error(frame.message));
        } else if (frame.t === 'peer_gone') {
          cleanup();
          this.setState('disconnected');
          reject(new Error('Agent disconnected.'));
        } else if (frame.t === 'socket_closed') {
          cleanup();
          this.setState('disconnected');
          reject(new Error('Relay connection closed.'));
        }
      };
      this.handlers.push(handler);
      ws.send(
        JSON.stringify({
          t: 'api_req',
          reqId,
          method,
          path,
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.opening = null;
    this.paired = false;
    this.setState('disconnected');
  }
}
