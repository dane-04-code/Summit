/**
 * The shared, framework-agnostic agent model. See `docs/AGENTS.md`.
 *
 * An `Agent` is one configured connection to one agent server (Hermes is
 * one-server-one-agent). `transport` decides how the phone reaches it; the
 * secret (API key or relay device token) never lives here — it's in the
 * Keychain (`secrets.ts`). Sessions and messages hang off an agent.
 */

import type { Message } from '@/ui/chat/types';

/**
 * `hermes` / `openclaw` are Tier 1 native integrations; `openai` is the Tier 2
 * generic floor — any server that speaks the OpenAI `/v1/chat/completions`
 * format (Ollama, LM Studio, llama.cpp, …) gets clean messaging, nothing more.
 */
export type AgentFramework = 'hermes' | 'openclaw' | 'openai';
export type AgentTransport = 'direct' | 'relay';
/** Which agent-side process is on the other end of a relay pairing: the Go
 *  connector (fallback/compat) or a native framework plugin. Only meaningful
 *  for `transport: 'relay'`; absent on relay agents means an older connector. */
export type ConnectionVia = 'connector' | 'plugin';

/** Snapshot of what a server supports, captured on connect. */
export type AgentCapabilities = {
  framework: AgentFramework;
  hasRunApproval: boolean;
  hasRunStop: boolean;
  hasStreaming: boolean;
  hasJobs: boolean;
  hasSessions: boolean;
  serverVersion?: string;
  /** Generic servers need a real model id in the request; captured on connect. */
  chatModel?: string;
};

export type Agent = {
  id: string;
  name: string;
  framework: AgentFramework;
  transport: AgentTransport;
  /** direct: `host:port` base URL; relay: null (the relay is implicit). */
  baseUrl: string | null;
  capabilities: AgentCapabilities | null;
  /** Optional so existing fixtures/tests need no update; absent = 'connector'. */
  connectionVia?: ConnectionVia | null;
  /**
   * User-chosen accent color. The mark itself is the official framework logo
   * (or a neutral fallback) and is not user-chosen; only the tint is. Value is
   * validated at render time (`resolveAccent`), so an unknown string from an
   * older or newer build degrades to the neutral default instead of throwing.
   */
  accentColor?: string | null;
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
  connectionVia?: ConnectionVia | null;
  accentColor?: string | null;
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
