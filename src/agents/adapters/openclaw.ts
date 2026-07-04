/**
 * OpenClaw adapter — the extension point, intentionally not implemented.
 *
 * OpenClaw differs from Hermes on everything past basic chat: no
 * `/v1/capabilities`, no REST runs/approval (WebSocket-only, issue #20934),
 * different session headers, port 18789 (`FRAMEWORKS.md`). It needs its own
 * research pass before it ships. This stub exists so the factory and the model
 * already account for it — adding OpenClaw is filling these methods in, not
 * reshaping the app.
 */

import type { AgentCapabilities } from '../types';
import type { CronJob, CronRun } from '@/ui/cron/types';
import {
  AgentAdapter,
  AgentStatus,
  ConnectionState,
  SendOptions,
  StreamEvent,
} from './types';

const NOT_READY = 'OpenClaw support is not implemented yet.';

export class OpenClawAdapter implements AgentAdapter {
  readonly framework = 'openclaw' as const;

  testConnection(): Promise<AgentCapabilities> {
    return Promise.reject(new Error(NOT_READY));
  }

  sendMessage(_content: string, _opts?: SendOptions): AsyncIterable<StreamEvent> {
    throw new Error(NOT_READY);
  }

  getStatus(): Promise<AgentStatus> {
    return Promise.reject(new Error(NOT_READY));
  }

  getConnectionState(): ConnectionState {
    return 'unknown';
  }

  subscribeConnectionState(_listener: (state: ConnectionState) => void): () => void {
    return () => {};
  }

  retryConnection(): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }

  approveRun(_runId: string, _approved: boolean): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }

  stopRun(_runId: string): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }

  listJobs(): Promise<CronJob[]> {
    return Promise.reject(new Error(NOT_READY));
  }

  getJobRun(_jobId: string): Promise<CronRun | null> {
    return Promise.reject(new Error(NOT_READY));
  }

  pauseJob(_jobId: string): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }

  resumeJob(_jobId: string): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }

  triggerJob(_jobId: string): Promise<void> {
    return Promise.reject(new Error(NOT_READY));
  }
}
