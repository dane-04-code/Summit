import type { AgentAdapter, AgentStatus, SendOptions, StreamEvent } from './types';
import type { AgentCapabilities, AgentFramework, Agent } from '../types';
import type { ChatMessage } from '../relay/types';
import { RelayClient } from '../relay/client';
import { RELAY_WS_URL } from '@/config';

export class RelayAdapter implements AgentAdapter {
  readonly framework: AgentFramework = 'hermes';
  private client: RelayClient | null = null;
  private pairingCode: string | null = null;

  constructor(
    private readonly agent: Agent,
    private readonly getSecret: () => Promise<string | null>,
  ) {}

  private async ensureConnected(): Promise<RelayClient> {
    if (this.client) return this.client;
    const code = await this.getSecret();
    if (!code) throw new Error('No pairing code stored for this agent.');
    const wsUrl = `${RELAY_WS_URL}?code=${encodeURIComponent(code)}`;
    const client = new RelayClient(wsUrl);
    await client.pair(code);
    this.client = client;
    this.pairingCode = code;
    return client;
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

  async approveRun(_runId: string, _approved: boolean): Promise<void> {}

  async stopRun(_runId: string): Promise<void> {}
}
