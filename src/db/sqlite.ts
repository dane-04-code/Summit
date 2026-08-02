/**
 * expo-sqlite implementation of `Repository` (device). Serializes the
 * `capabilities` snapshot and the structured message to JSON columns.
 *
 * Upserts use `ON CONFLICT ... DO UPDATE` rather than `INSERT OR REPLACE`,
 * because REPLACE deletes the row first and would cascade-wipe a session's
 * messages on every save.
 */

import * as SQLite from 'expo-sqlite';

import type { Agent, AgentCapabilities, ChatSession, StoredMessage } from '@/agents/types';
import type { Message } from '@/ui/chat/types';
import type { Repository } from './repository';
import { AGENT_COLUMN_MIGRATIONS, DATABASE_NAME, SCHEMA } from './schema';

type ColumnInfoRow = { name: string };

type AgentRow = {
  id: string;
  name: string;
  framework: string;
  transport: string;
  base_url: string | null;
  capabilities: string | null;
  connection_via: string | null;
  avatar_id: string | null;
  accent_color: string | null;
  created_at: number;
  last_used_at: number;
};

type SessionRow = {
  id: string;
  agent_id: string;
  title: string | null;
  remote_session_key: string | null;
  created_at: number;
  updated_at: number;
};

type MessageRow = {
  id: string;
  session_id: string;
  content: string;
  created_at: number;
};

type MetaRow = { value: string };

function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    framework: row.framework as Agent['framework'],
    transport: row.transport as Agent['transport'],
    baseUrl: row.base_url,
    capabilities: row.capabilities
      ? (JSON.parse(row.capabilities) as AgentCapabilities)
      : null,
    connectionVia: (row.connection_via as Agent['connectionVia']) ?? null,
    avatarId: row.avatar_id ?? null,
    accentColor: row.accent_color ?? null,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function toSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    remoteSessionKey: row.remote_session_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SqliteRepository implements Repository {
  private db: SQLite.SQLiteDatabase | null = null;

  private require(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('Repository.init() must be called before use');
    return this.db;
  }

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await this.db.execAsync(SCHEMA);
    await this.migrateAgentColumns();
  }

  /**
   * Add any `agents` columns introduced after this device first paired. Driven
   * off `PRAGMA table_info` rather than a version counter so it stays correct
   * whichever release the install came from, and is safe to run every launch.
   */
  private async migrateAgentColumns(): Promise<void> {
    const db = this.require();
    const existing = new Set(
      (await db.getAllAsync<ColumnInfoRow>('PRAGMA table_info(agents)')).map((c) => c.name),
    );
    for (const column of AGENT_COLUMN_MIGRATIONS) {
      if (existing.has(column.name)) continue;
      await db.execAsync(column.ddl);
    }
  }

  async listAgents(): Promise<Agent[]> {
    const rows = await this.require().getAllAsync<AgentRow>(
      'SELECT * FROM agents ORDER BY last_used_at DESC',
    );
    return rows.map(toAgent);
  }

  async getAgent(id: string): Promise<Agent | null> {
    const row = await this.require().getFirstAsync<AgentRow>(
      'SELECT * FROM agents WHERE id = ?',
      id,
    );
    return row ? toAgent(row) : null;
  }

  async upsertAgent(agent: Agent): Promise<void> {
    await this.require().runAsync(
      `INSERT INTO agents (id, name, framework, transport, base_url, capabilities, connection_via, avatar_id, accent_color, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         framework = excluded.framework,
         transport = excluded.transport,
         base_url = excluded.base_url,
         capabilities = excluded.capabilities,
         connection_via = excluded.connection_via,
         avatar_id = excluded.avatar_id,
         accent_color = excluded.accent_color,
         last_used_at = excluded.last_used_at`,
      agent.id,
      agent.name,
      agent.framework,
      agent.transport,
      agent.baseUrl,
      agent.capabilities ? JSON.stringify(agent.capabilities) : null,
      agent.connectionVia ?? null,
      agent.avatarId ?? null,
      agent.accentColor ?? null,
      agent.createdAt,
      agent.lastUsedAt,
    );
  }

  async deleteAgent(id: string): Promise<void> {
    await this.require().runAsync('DELETE FROM agents WHERE id = ?', id);
  }

  async listSessions(agentId: string): Promise<ChatSession[]> {
    const rows = await this.require().getAllAsync<SessionRow>(
      'SELECT * FROM sessions WHERE agent_id = ? ORDER BY updated_at DESC',
      agentId,
    );
    return rows.map(toSession);
  }

  async getSession(id: string): Promise<ChatSession | null> {
    const row = await this.require().getFirstAsync<SessionRow>(
      'SELECT * FROM sessions WHERE id = ?',
      id,
    );
    return row ? toSession(row) : null;
  }

  async upsertSession(session: ChatSession): Promise<void> {
    await this.require().runAsync(
      `INSERT INTO sessions (id, agent_id, title, remote_session_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         remote_session_key = excluded.remote_session_key,
         updated_at = excluded.updated_at`,
      session.id,
      session.agentId,
      session.title,
      session.remoteSessionKey,
      session.createdAt,
      session.updatedAt,
    );
  }

  async deleteSession(id: string): Promise<void> {
    await this.require().runAsync('DELETE FROM sessions WHERE id = ?', id);
  }

  async listMessages(sessionId: string): Promise<StoredMessage[]> {
    const rows = await this.require().getAllAsync<MessageRow>(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      sessionId,
    );
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      message: JSON.parse(row.content) as Message,
      createdAt: row.created_at,
    }));
  }

  async appendMessage(message: StoredMessage): Promise<void> {
    await this.require().runAsync(
      'INSERT OR REPLACE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      message.id,
      message.sessionId,
      message.message.role,
      JSON.stringify(message.message),
      message.createdAt,
    );
  }

  async getMeta(key: string): Promise<string | null> {
    const row = await this.require().getFirstAsync<MetaRow>(
      'SELECT value FROM app_meta WHERE key = ?',
      key,
    );
    return row ? row.value : null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.require().runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }
}
