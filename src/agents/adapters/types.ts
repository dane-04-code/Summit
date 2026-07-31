/**
 * The one interface that hides every Hermes/OpenClaw difference from the rest
 * of the app. Storage, registry, and UI never branch on framework — they hold
 * an `AgentAdapter`. See `docs/AGENTS.md` §3 and `FRAMEWORKS.md`.
 */

import type { AgentCapabilities, AgentFramework } from '../types';
import type { ModelProvider, ModelScope } from '../relay/types';
import type { CronJob, CronRun } from '@/ui/cron/types';

export type { ModelProvider, ModelScope };

/** What the agent is running now, and what it will let you switch to. */
export type ModelCatalogue = {
  currentModel: string;
  currentProvider: string;
  providers: ModelProvider[];
};

export type AgentStatus = 'idle' | 'running' | 'error';

export type ConnectionState =
  | 'unknown'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'pairing_expired';

/** A normalized event from a streamed turn — same shape across frameworks. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; label: string }
  // A tool call gated behind an approval policy. The run pauses until resolved
  // via approveRun/stopRun. Only Tier-1 agents with `hasRunApproval` emit this.
  | { type: 'approval'; runId: string; title: string; command: string }
  // The phone-side socket vanished, but the connector-owned turn continues.
  // The settled result arrives through background sync on reconnect.
  | { type: 'detached' }
  // Native transports can supply the authoritative final text when a draft
  // was revised mid-turn. Other transports continue to use streamed deltas.
  | { type: 'done'; eventId?: string; content?: string }
  | { type: 'error'; message: string; eventId?: string };

export type SettledReply = {
  id: string;
  reqId: string;
  sessionId: string;
  status: 'done' | 'error';
  content: string;
  error?: string;
  createdAt: number;
};

export type SendOptions = {
  /** X-Hermes-Session-Id — transcript-scoped, rotates on a new chat. */
  sessionId?: string;
  /** X-Hermes-Session-Key — stable channel identity, ties into memory. */
  sessionKey?: string;
};

export type ConnectionErrorKind =
  | 'unreachable' // never got a response (offline / wrong host / server down)
  | 'unauthorized' // 401/403 — key rejected
  | 'wrong-shape' // responded, but not a recognizable agent server
  | 'server-error'; // other non-2xx

/** Typed connect failure so the connect screen can show a specific message. */
export class ConnectionError extends Error {
  constructor(
    public readonly kind: ConnectionErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export interface AgentAdapter {
  readonly framework: AgentFramework;

  /** Probe the server and return its capability snapshot. Throws ConnectionError. */
  testConnection(): Promise<AgentCapabilities>;

  /** Stream one turn. Yields normalized events until `done` or `error`. */
  sendMessage(content: string, opts?: SendOptions): AsyncIterable<StreamEvent>;

  getStatus(): Promise<AgentStatus>;

  getConnectionState(): ConnectionState;
  subscribeConnectionState(listener: (state: ConnectionState) => void): () => void;
  retryConnection(): Promise<void>;

  /** Relay-only durable delivery hooks; direct adapters have no remote outbox. */
  syncPendingReplies?(): Promise<SettledReply[]>;
  acknowledgeReplies?(ids: string[]): Promise<void>;
  /** A content-free signal that a host-owned asynchronous reply is ready to sync. */
  subscribeProactiveDelivery?(listener: () => void): Promise<() => void>;

  /**
   * Model switching, gated on what the connected host advertised at pair time
   * rather than on framework — an older plugin has no picker to surface, and
   * the UI must stay dark until it does. False means `listModels`/`selectModel`
   * must not be called.
   */
  supportsModelPicker?(): boolean;
  /** The host's own picker payload. `scope` fixes where a later pick sticks. */
  listModels?(sessionId: string, scope: ModelScope): Promise<ModelCatalogue>;
  /** Switch to one entry from the last catalogue; resolves with the host's note. */
  selectModel?(sessionId: string, provider: string, model: string): Promise<string>;

  // Runs API — Hermes only in v1 (gate on capabilities.hasRunApproval).
  approveRun(runId: string, approved: boolean): Promise<void>;
  stopRun(runId: string): Promise<void>;

  listJobs(): Promise<CronJob[]>;
  getJobRun(jobId: string): Promise<CronRun | null>;
  pauseJob(jobId: string): Promise<void>;
  resumeJob(jobId: string): Promise<void>;
  triggerJob(jobId: string): Promise<void>;
}
