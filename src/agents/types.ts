/**
 * The shared, framework-agnostic agent model. See `docs/AGENTS.md`.
 *
 * An `Agent` is one configured connection to one agent server (Hermes is
 * one-server-one-agent). `transport` decides how the phone reaches it; the
 * secret (API key or relay device token) never lives here — it's in the
 * Keychain (`secrets.ts`). Sessions and messages hang off an agent.
 */

import type { Message } from '@/ui/chat/types';

export type AgentFramework = 'hermes' | 'openclaw';
export type AgentTransport = 'direct' | 'relay';

/** Snapshot of what a server supports, captured on connect. */
export type AgentCapabilities = {
  framework: AgentFramework;
  hasRunApproval: boolean;
  hasRunStop: boolean;
  hasStreaming: boolean;
  hasJobs: boolean;
  hasSessions: boolean;
  serverVersion?: string;
};

export type Agent = {
  id: string;
  name: string;
  framework: AgentFramework;
  transport: AgentTransport;
  /** direct: `host:port` base URL; relay: null (the relay is implicit). */
  baseUrl: string | null;
  capabilities: AgentCapabilities | null;
  createdAt: number;
  lastUsedAt: number;
};

/** What the connect/pair flow produces, before an id + timestamps are assigned. */
export type NewAgentInput = {
  name: string;
  framework: AgentFramework;
  transport: AgentTransport;
  baseUrl: string | null;
  capabilities?: AgentCapabilities | null;
};

export type ChatSession = {
  id: string;
  agentId: string;
  title: string | null;
  /** X-Hermes-Session-Key / OpenClaw session key — stable channel identity. */
  remoteSessionKey: string | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * A persisted chat message. `message` is the rich UI model (blocks/spans/text)
 * stored verbatim as JSON, so markdown/code/approval structure survives a
 * reload — not just flattened text.
 */
export type StoredMessage = {
  id: string;
  sessionId: string;
  message: Message;
  createdAt: number;
};
