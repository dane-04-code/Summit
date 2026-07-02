import type { AnyFrame, ChatMessage, PairErrorFrame } from './types';
import type { StreamEvent } from '../adapters/types';
import { RelayError, type RelayErrorCode } from './errors';

const PAIR_ERROR_CODE: Record<PairErrorFrame['reason'], RelayErrorCode> = {
  not_found: 'code_not_found',
  expired: 'code_expired',
  already_paired: 'already_paired',
};

export type RelayAgentInfo = { framework: string; agentName: string; agentVersion: string };

export class RelayClient {
  private ws: WebSocket | null = null;
  private opening: Promise<WebSocket> | null = null;
  private handlers: Array<(frame: AnyFrame) => void> = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private pairCode: string | null = null;
  private paired = false;

  constructor(private readonly wsUrl: string) {}

  private connect(): Promise<WebSocket> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve(this.ws);
    if (this.opening) return this.opening;

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
        reject(new RelayError('relay_unreachable'));
      };
      ws.onclose = () => {
        this.opening = null;
        this.stopHeartbeat();
        this.paired = false;
        if (this.ws === ws) this.ws = null;
        // Only wins the opening promise if the socket closed before it opened —
        // i.e. we never reached the relay. A mid-session drop settles this reject
        // as a no-op and instead reaches live handlers via the peer_gone below.
        reject(new RelayError('relay_unreachable'));
        for (const h of this.handlers) h({ t: 'peer_gone' });
      };
      ws.onmessage = (e) => {
        const frame = JSON.parse(e.data as string) as AnyFrame;
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
          resolve({ framework: frame.framework, agentName: frame.agentName, agentVersion: frame.agentVersion });
        } else if (frame.t === 'pair_error') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          reject(new RelayError(PAIR_ERROR_CODE[frame.reason]));
        } else if (frame.t === 'peer_gone') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          reject(new RelayError('agent_disconnected'));
        }
      };
      this.handlers.push(handler);
      ws.send(JSON.stringify({ t: 'pair', code }));
    });
  }

  async *chat(messages: ChatMessage[], reqId: string, sessionId?: string, sessionKey?: string): AsyncIterable<StreamEvent> {
    if (this.pairCode && !this.paired) {
      await this.pair(this.pairCode);
    }
    const ws = await this.connect();
    ws.send(JSON.stringify({ t: 'chat', reqId, messages, sessionId, sessionKey }));

    const queue: StreamEvent[] = [];
    let notify: (() => void) | null = null;
    let done = false;

    const handler = (frame: AnyFrame) => {
      if (frame.t === 'chunk' && frame.reqId === reqId) {
        queue.push({ type: 'delta', text: frame.delta });
      } else if (frame.t === 'done' && frame.reqId === reqId) {
        queue.push({ type: 'done' });
        done = true;
      } else if (frame.t === 'error' && (!frame.reqId || frame.reqId === reqId)) {
        queue.push({ type: 'error', message: frame.message });
        done = true;
      } else if (frame.t === 'peer_gone') {
        queue.push({ type: 'error', message: 'Agent disconnected.' });
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
    if (this.pairCode && !this.paired) {
      await this.pair(this.pairCode);
    }
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
          reject(new Error('Agent disconnected.'));
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
  }
}
