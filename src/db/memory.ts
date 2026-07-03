/**
 * In-memory `Repository` — used in tests and as the web fallback (no native
 * SQLite there). Mirrors the SQLite store's semantics, including cascade
 * delete and recency ordering, so logic tested here holds on device.
 */

import type { Agent, ChatSession, StoredMessage } from '@/agents/types';
import type { Repository } from './repository';

export class InMemoryRepository implements Repository {
  private agents = new Map<string, Agent>();
  private sessions = new Map<string, ChatSession>();
  private messages = new Map<string, StoredMessage>();
  private meta = new Map<string, string>();

  async init(): Promise<void> {
    // nothing to migrate in memory
  }

  async listAgents(): Promise<Agent[]> {
    return [...this.agents.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) ?? null;
  }

  async upsertAgent(agent: Agent): Promise<void> {
    this.agents.set(agent.id, { ...agent });
  }

  async deleteAgent(id: string): Promise<void> {
    this.agents.delete(id);
    for (const session of [...this.sessions.values()]) {
      if (session.agentId === id) await this.deleteSession(session.id);
    }
  }

  async listSessions(agentId: string): Promise<ChatSession[]> {
    return [...this.sessions.values()]
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getSession(id: string): Promise<ChatSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async upsertSession(session: ChatSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
    for (const message of [...this.messages.values()]) {
      if (message.sessionId === id) this.messages.delete(message.id);
    }
  }

  async listMessages(sessionId: string): Promise<StoredMessage[]> {
    return [...this.messages.values()]
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async appendMessage(message: StoredMessage): Promise<void> {
    this.messages.set(message.id, { ...message });
  }

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
  }
}
