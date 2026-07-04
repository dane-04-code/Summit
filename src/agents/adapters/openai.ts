/**
 * Generic OpenAI-compatible adapter — the Tier 2 floor. Works with anything
 * that speaks the OpenAI API: Ollama, LM Studio, llama.cpp server, Open WebUI,
 * OpenRouter, LangServe, … Probe is `GET /v1/models`; chat is SSE
 * `POST /v1/chat/completions`. Clean messaging, nothing more: runs and jobs
 * reject, and the capability flags keep the UI from ever offering them.
 */

import type { Agent, AgentCapabilities } from '../types';
import { normalizeBaseUrl } from './hermes';
import { streamChatCompletions } from './sse';
import {
  AgentAdapter,
  AgentStatus,
  ConnectionState,
  ConnectionError,
  SendOptions,
  StreamEvent,
} from './types';
import type { CronJob, CronRun } from '@/ui/cron/types';

type ModelsResponse = { object?: string; data?: { id?: string }[] };

const NO_RUNS = "This agent doesn't support runs.";
const NO_JOBS = "This agent doesn't support scheduled jobs.";

export class OpenAICompatAdapter implements AgentAdapter {
  readonly framework = 'openai' as const;
  private readonly base: string;
  private readonly model: string | undefined;
  private connectionState: ConnectionState = 'unknown';
  private listeners: Array<(state: ConnectionState) => void> = [];

  constructor(
    agent: Agent,
    private readonly getSecret: () => Promise<string | null>,
  ) {
    if (!agent.baseUrl) {
      throw new ConnectionError('server-error', 'A direct-mode agent requires a base URL.');
    }
    this.base = normalizeBaseUrl(agent.baseUrl);
    this.model = agent.capabilities?.chatModel;
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    for (const listener of this.listeners) listener(state);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  subscribeConnectionState(listener: (state: ConnectionState) => void): () => void {
    this.listeners.push(listener);
    listener(this.connectionState);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  async retryConnection(): Promise<void> {
    await this.testConnection();
  }

  async testConnection(): Promise<AgentCapabilities> {
    const key = await this.getSecret();
    let res: Response;
    try {
      this.setConnectionState(this.connectionState === 'connected' ? 'reconnecting' : 'connecting');
      res = await fetch(`${this.base}/v1/models`, {
        headers: { Authorization: `Bearer ${key ?? ''}` },
      });
    } catch {
      this.setConnectionState('disconnected');
      throw new ConnectionError('unreachable', `Couldn't reach ${this.base}.`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ConnectionError('unauthorized', "Server's there, but the API key was rejected.");
    }
    let body: ModelsResponse;
    try {
      body = (await res.json()) as ModelsResponse;
    } catch {
      body = {};
    }
    if (!res.ok || !Array.isArray(body.data)) {
      this.setConnectionState('disconnected');
      throw new ConnectionError(
        'wrong-shape',
        "Reached something, but it doesn't speak the OpenAI API.",
      );
    }
    this.setConnectionState('connected');
    const firstModel = body.data[0]?.id;
    return {
      framework: 'openai',
      hasRunApproval: false,
      hasRunStop: false,
      hasStreaming: true,
      hasJobs: false,
      hasSessions: false,
      ...(typeof firstModel === 'string' ? { chatModel: firstModel } : {}),
    };
  }

  sendMessage(content: string, _opts: SendOptions = {}): AsyncIterable<StreamEvent> {
    this.setConnectionState(this.connectionState === 'connected' ? 'reconnecting' : 'connecting');
    return streamChatCompletions({
      url: `${this.base}/v1/chat/completions`,
      getHeaders: async () => ({
        Authorization: `Bearer ${(await this.getSecret()) ?? ''}`,
      }),
      // Unlike Hermes, generic servers route on the model id — send the one
      // captured at connect. Single-model servers ignore an unknown value.
      body: {
        model: this.model ?? 'default',
        stream: true,
        messages: [{ role: 'user', content }],
      },
      onActivity: () => this.setConnectionState('connected'),
      onDisconnected: () => this.setConnectionState('disconnected'),
    });
  }

  async getStatus(): Promise<AgentStatus> {
    return 'idle';
  }

  approveRun(_runId: string, _approved: boolean): Promise<void> {
    return Promise.reject(new Error(NO_RUNS));
  }

  stopRun(_runId: string): Promise<void> {
    return Promise.reject(new Error(NO_RUNS));
  }

  listJobs(): Promise<CronJob[]> {
    return Promise.reject(new Error(NO_JOBS));
  }

  getJobRun(_jobId: string): Promise<CronRun | null> {
    return Promise.reject(new Error(NO_JOBS));
  }

  pauseJob(_jobId: string): Promise<void> {
    return Promise.reject(new Error(NO_JOBS));
  }

  resumeJob(_jobId: string): Promise<void> {
    return Promise.reject(new Error(NO_JOBS));
  }

  triggerJob(_jobId: string): Promise<void> {
    return Promise.reject(new Error(NO_JOBS));
  }
}
