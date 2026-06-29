import type { AnyFrame, ChatMessage } from './types';
import type { StreamEvent } from '../adapters/types';

export type RelayAgentInfo = { framework: string; agentName: string; agentVersion: string };

export class RelayClient {
  private ws: WebSocket | null = null;
  private handlers: Array<(frame: AnyFrame) => void> = [];

  constructor(private readonly wsUrl: string) {}

  private getWs(): WebSocket {
    if (this.ws) return this.ws;
    const ws = new WebSocket(this.wsUrl);
    ws.onmessage = (e) => {
      const frame = JSON.parse(e.data as string) as AnyFrame;
      for (const h of this.handlers) h(frame);
    };
    this.ws = ws;
    return ws;
  }

  pair(code: string): Promise<RelayAgentInfo> {
    return new Promise((resolve, reject) => {
      const ws = this.getWs();

      const handler = (frame: AnyFrame) => {
        if (frame.t === 'paired') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          resolve({ framework: frame.framework, agentName: frame.agentName, agentVersion: frame.agentVersion });
        } else if (frame.t === 'pair_error') {
          this.handlers = this.handlers.filter((h) => h !== handler);
          reject(new Error(frame.reason));
        }
      };
      this.handlers.push(handler);

      const send = () => ws.send(JSON.stringify({ t: 'pair', code }));
      if (ws.readyState === 1 /* OPEN */) {
        send();
      } else {
        ws.onopen = send;
        ws.onerror = () => reject(new Error('WebSocket error'));
      }
    });
  }

  async *chat(messages: ChatMessage[], reqId: string, sessionId?: string, sessionKey?: string): AsyncIterable<StreamEvent> {
    const ws = this.getWs();
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

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
