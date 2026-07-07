import type { AgentAdapter, AgentStatus, ConnectionState, SendOptions, StreamEvent } from './types';
import type { AgentCapabilities, AgentFramework, Agent } from '../types';
import type { ChatMessage } from '../relay/types';
import type { CronJob, CronRun } from '@/ui/cron/types';
import { RelayClient } from '../relay/client';
import { readJobRunResponse, readJobsResponse } from './jobs';
import { RELAY_WS_URL } from '@/config';
import { resolvePushToken } from '@/notifications/push';
import { captureError } from '@/lib/errorReporting';

const enc = encodeURIComponent;

/** Human message for a non-2xx proxied response. */
function apiError(status: number, body: string): string {
  if (status === 401 || status === 403) return "The agent rejected the request (key or permission).";
  if (status === 404) return 'Not found on the agent.';
  if (status === 502) return "Couldn't reach the agent — is the connector online?";
  const detail = body?.trim();
  return detail ? `Agent returned ${status}: ${detail.slice(0, 120)}` : `Agent returned ${status}.`;
}

/** Parse a JSON body defensively — empty/non-JSON becomes null. */
function parseJson(body: string): unknown {
  if (!body?.trim()) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export class RelayAdapter implements AgentAdapter {
  readonly framework: AgentFramework;
  private client: RelayClient | null = null;
  private pairingCode: string | null = null;
  private connectionState: ConnectionState = 'unknown';
  private listeners: Array<(state: ConnectionState) => void> = [];

  constructor(
    private readonly agent: Agent,
    private readonly getSecret: () => Promise<string | null>,
    private readonly getPushToken: () => Promise<string | null> = resolvePushToken,
  ) {
    this.framework = agent.framework;
  }

  private async ensureConnected(): Promise<RelayClient> {
    if (this.client) return this.client;
    const code = await this.getSecret();
    if (!code) throw new Error('No pairing code stored for this agent.');
    const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(code)}`;
    const client = new RelayClient(wsUrl);
    client.subscribeConnectionState((state) => this.setConnectionState(state));
    await client.pair(code);
    this.client = client;
    this.pairingCode = code;
    this.registerPushToken(client);
    return client;
  }

  /** Fire-and-forget: push is an enhancement, never a blocker for chat. */
  private registerPushToken(client: RelayClient): void {
    void this.getPushToken()
      .then((token) => (token ? client.registerPush(token) : undefined))
      .catch((e) => captureError(e, { where: 'push_register', transport: 'relay', framework: this.framework }));
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
    this.client?.disconnect();
    this.client = null;
    await this.ensureConnected();
  }

  async *sendMessage(content: string, opts?: SendOptions): AsyncIterable<StreamEvent> {
    const client = await this.ensureConnected();
    const messages: ChatMessage[] = [{ role: 'user', content }];
    const reqId = String(Date.now());
    // Use the pairing code as a stable session ID — same device always maps to
    // the same Hermes session, giving persistent memory across chats like Telegram.
    yield* client.chat(messages, reqId, this.pairingCode ?? undefined, opts?.sessionKey);
  }

  async testConnection(): Promise<AgentCapabilities> {
    throw new Error('Use the pairing screen to connect relay agents.');
  }

  async getStatus(): Promise<AgentStatus> {
    return 'idle';
  }

  /** Proxy one allow-listed Hermes REST call through the connector; returns the body. */
  private async api(method: string, path: string, body?: unknown): Promise<string> {
    const client = await this.ensureConnected();
    const res = await client.request(method, path, body);
    if (res.status < 200 || res.status >= 300) {
      throw new Error(apiError(res.status, res.body));
    }
    return res.body;
  }

  async approveRun(runId: string, approved: boolean): Promise<void> {
    if (this.framework === 'openclaw') {
      // OpenClaw approvals are push-based: runId is the Gateway approval id
      // and the decision goes back as an approval_resolve frame.
      const client = await this.ensureConnected();
      await client.resolveApproval(runId, approved ? 'approve' : 'deny');
      return;
    }
    await this.api('POST', `/v1/runs/${enc(runId)}/approval`, { approved });
  }

  async stopRun(runId: string): Promise<void> {
    if (this.framework === 'openclaw') {
      // No run-stop on the Gateway; stopping an approval card means denying it.
      const client = await this.ensureConnected();
      await client.resolveApproval(runId, 'deny');
      return;
    }
    await this.api('POST', `/v1/runs/${enc(runId)}/stop`);
  }

  async listJobs(): Promise<CronJob[]> {
    return readJobsResponse(parseJson(await this.api('GET', '/api/jobs')));
  }

  async getJobRun(jobId: string): Promise<CronRun | null> {
    return readJobRunResponse(parseJson(await this.api('GET', `/api/jobs/${enc(jobId)}`)));
  }

  async pauseJob(jobId: string): Promise<void> {
    await this.api('POST', `/api/jobs/${enc(jobId)}/pause`);
  }

  async resumeJob(jobId: string): Promise<void> {
    await this.api('POST', `/api/jobs/${enc(jobId)}/resume`);
  }

  async triggerJob(jobId: string): Promise<void> {
    await this.api('POST', `/api/jobs/${enc(jobId)}/run`);
  }
}
