/**
 * SQLite schema for the on-device agent store. See `docs/AGENTS.md` §4.
 * No secrets here — only non-secret metadata, sessions, and the transcript.
 * Timestamps are epoch milliseconds. `ON DELETE CASCADE` makes deleting an
 * agent remove its sessions and messages in one step.
 */

export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agents (
  id           TEXT PRIMARY KEY NOT NULL,
  name         TEXT NOT NULL,
  framework    TEXT NOT NULL,
  transport    TEXT NOT NULL,
  base_url     TEXT,
  capabilities TEXT,
  connection_via TEXT,
  avatar_id    TEXT,
  accent_color TEXT,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id                 TEXT PRIMARY KEY NOT NULL,
  agent_id           TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title              TEXT,
  remote_session_key TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

/**
 * Columns added to `agents` after the first release. `CREATE TABLE IF NOT
 * EXISTS` is a no-op on a database that already has the table, so a device
 * that paired before these shipped would keep the old column set and fail on
 * the first read or write that names one. `init()` adds whatever is missing.
 *
 * Every entry must be nullable with no default so it can be added to a table
 * that already has rows. Append only — never renumber or remove.
 */
export const AGENT_COLUMN_MIGRATIONS: { name: string; ddl: string }[] = [
  { name: 'connection_via', ddl: 'ALTER TABLE agents ADD COLUMN connection_via TEXT' },
  { name: 'avatar_id', ddl: 'ALTER TABLE agents ADD COLUMN avatar_id TEXT' },
  { name: 'accent_color', ddl: 'ALTER TABLE agents ADD COLUMN accent_color TEXT' },
];

export const DATABASE_NAME = 'agent-messenger.db';
