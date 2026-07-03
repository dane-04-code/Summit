/**
 * Hermes adapter — direct transport (host + API key on device). The relay
 * transport is a different path (WebSocket to our relay) and isn't built yet,
 * so this guards against it rather than pretending. See `FRAMEWORKS.md`.
 *
 * Connect = `GET /v1/capabilities`. Chat = `POST /v1/chat/completions` (SSE).
 * Approve/stop = the Runs API. All endpoints confirmed in `FRAMEWORKS.md`.
 */

import EventSource from 'react-native-sse';

import type { Agent, AgentCapabilities } from '../types';
import { EventQueue } from './stream';
import {
  AgentAdapter,
  AgentStatus,
  ConnectionError,
  SendOptions,
  StreamEvent,
} from './types';
import { readJobRunResponse, readJobsResponse } from './jobs';
import type { CronJob, CronRun } from '@/ui/cron/types';

type CapabilitiesResponse = {
  object?: string;
  platform?: string;
  features?: Record<string, boolean>;
};

const PRIVATE_HOST_RE =
  /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}|\[?::1\]?|.*\.(local|home))$/i;

function parseHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return '';
  }
}

/** Accepts `host:port` or a full URL; yields a scheme-qualified, slash-trimmed base. */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (base.toLowerCase().startsWith('http://')) {
    const host = parseHost(base);
    if (!PRIVATE_HOST_RE.test(host)) {
      throw new ConnectionError(
        'server-error',
        'Plain HTTP is only allowed for local/private direct-mode hosts. Use HTTPS for internet-reachable agents.',
      );
    }
  }
  return base;
}

export class HermesAdapter implements AgentAdapter {
  readonly framework = 'hermes' as const;
  private readonly base: string;

  constructor(
    agent: Agent,
    private readonly getSecret: () => Promise<string | null>,
  ) {
    if (agent.transport === 'relay') {
      throw new Error('Relay transport is not implemented yet — use direct mode.');
    }
    if (!agent.baseUrl) {
      throw new Error('A direct-mode Hermes agent requires a base URL.');
    }
    this.base = normalizeBaseUrl(agent.baseUrl);
  }

  private async req(path: string, init?: RequestInit): Promise<Response> {
    const key = await this.getSecret();
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key ?? ''}`,
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });
    } catch {
      throw new ConnectionError('unreachable', `Couldn't reach ${this.base}.`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ConnectionError('unauthorized', "Server's there, but the API key was rejected.");
    }
    if (!res.ok) {
      throw new ConnectionError('server-error', `Server returned ${res.status}.`);
    }
    return res;
  }

  async testConnection(): Promise<AgentCapabilities> {
    const res = await this.req('/v1/capabilities');
    let body: CapabilitiesResponse;
    try {
      body = (await res.json()) as CapabilitiesResponse;
    } catch {
      throw new ConnectionError('wrong-shape', "Reached something, but it doesn't look like Hermes.");
    }
    const f = body.features;
    if (!f || typeof f.chat_completions === 'undefined') {
      throw new ConnectionError('wrong-shape', "Reached something, but it doesn't look like Hermes.");
    }
    return {
      framework: 'hermes',
      hasRunApproval: f.run_approval === true,
      hasRunStop: f.run_stop === true,
      hasStreaming: f.chat_completions === true,
      hasJobs: f.run_submission === true,
      hasSessions: f.responses_api === true,
    };
  }

  sendMessage(content: string, opts: SendOptions = {}): AsyncIterable<StreamEvent> {
    const queue = new EventQueue<StreamEvent>();
    const url = `${this.base}/v1/chat/completions`;

    void this.getSecret()
      .then((key) => {
        const es = new EventSource<'hermes.tool.progress'>(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key ?? ''}`,
            'Content-Type': 'application/json',
            ...(opts.sessionId ? { 'X-Hermes-Session-Id': opts.sessionId } : {}),
            ...(opts.sessionKey ? { 'X-Hermes-Session-Key': opts.sessionKey } : {}),
          },
          // Single user turn. Full-history assembly belongs to the screen
          // integration pass (`docs/AGENTS.md` §9) — session headers carry
          // continuity via Honcho memory in the meantime.
          body: JSON.stringify({
            model: 'hermes-agent',
            stream: true,
            messages: [{ role: 'user', content }],
          }),
          pollingInterval: 0, // one-shot stream, don't reconnect
        });

        const close = () => {
          es.removeAllEventListeners();
          es.close();
          queue.close();
        };

        es.addEventListener('message', (event) => {
          const data = event.data;
          if (!data) return;
          if (data.trim() === '[DONE]') {
            queue.push({ type: 'done' });
            close();
            return;
          }
          try {
            const chunk = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) queue.push({ type: 'delta', text });
          } catch {
            // keep-alive or non-JSON frame — ignore
          }
        });

        es.addEventListener('hermes.tool.progress', (event) => {
          const label = readToolLabel(event.data);
          if (label) queue.push({ type: 'tool', label });
        });

        es.addEventListener('error', () => {
          queue.push({ type: 'error', message: 'The connection to the agent dropped.' });
          close();
        });
      })
      .catch((err: unknown) => {
        queue.push({
          type: 'error',
          message: err instanceof Error ? err.message : 'Could not start the stream.',
        });
        queue.close();
      });

    return queue;
  }

  async getStatus(): Promise<AgentStatus> {
    try {
      await this.req('/health');
      return 'idle';
    } catch {
      return 'error';
    }
  }

  async approveRun(runId: string, approved: boolean): Promise<void> {
    await this.req(`/v1/runs/${runId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ approved }),
    });
  }

  async stopRun(runId: string): Promise<void> {
    await this.req(`/v1/runs/${runId}/stop`, { method: 'POST' });
  }

  async listJobs(): Promise<CronJob[]> {
    const res = await this.req('/api/jobs');
    return readJobsResponse(await res.json());
  }

  async getJobRun(jobId: string): Promise<CronRun | null> {
    const res = await this.req(`/api/jobs/${encodeURIComponent(jobId)}`);
    return readJobRunResponse(await res.json());
  }

  async pauseJob(jobId: string): Promise<void> {
    await this.req(`/api/jobs/${encodeURIComponent(jobId)}/pause`, { method: 'POST' });
  }

  async resumeJob(jobId: string): Promise<void> {
    await this.req(`/api/jobs/${encodeURIComponent(jobId)}/resume`, { method: 'POST' });
  }

  async triggerJob(jobId: string): Promise<void> {
    await this.req(`/api/jobs/${encodeURIComponent(jobId)}/run`, { method: 'POST' });
  }
}

/** Pull a short human label out of a `hermes.tool.progress` frame, if present. */
function readToolLabel(data: string | null | undefined): string | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as { tool?: string; name?: string; label?: string };
    return parsed.label ?? parsed.tool ?? parsed.name ?? null;
  } catch {
    return null;
  }
}
