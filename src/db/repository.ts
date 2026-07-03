/**
 * The on-device persistence contract. Two implementations satisfy it:
 * `memory.ts` (tests + web fallback) and `sqlite.ts` (device). The registry
 * and chat-persistence logic depend only on this interface, never on a
 * concrete store — see `docs/AGENTS.md` §8.
 *
 * Secrets are NOT here: API keys / relay tokens live only in the Keychain
 * (`agents/secrets.ts`). This store holds non-secret metadata, sessions, and
 * the saved transcript.
 */

import type { Agent, ChatSession, StoredMessage } from '@/agents/types';

export interface Repository {
  /** Idempotent — open the store and run migrations. */
  init(): Promise<void>;

  // ── agents ────────────────────────────────────────────────────────────────
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | null>;
  upsertAgent(agent: Agent): Promise<void>;
  /** Removes the agent and cascades to its sessions + messages. */
  deleteAgent(id: string): Promise<void>;

  // ── sessions ──────────────────────────────────────────────────────────────
  listSessions(agentId: string): Promise<ChatSession[]>;
  getSession(id: string): Promise<ChatSession | null>;
  upsertSession(session: ChatSession): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // ── messages ──────────────────────────────────────────────────────────────
  listMessages(sessionId: string): Promise<StoredMessage[]>;
  appendMessage(message: StoredMessage): Promise<void>;

  // ── app meta (active agent id, etc.) ───────────────────────────────────────
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}
