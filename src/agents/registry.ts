/**
 * Pure helpers over the in-memory agent list held by `AgentProvider`. No I/O —
 * persistence is the repository's job; these just keep the live registry
 * consistent and recency-ordered so they're trivially testable.
 */

import type { Agent, NewAgentInput } from './types';

/** Collision-resistant id (base36 random + time), matching the chat screen. */
export function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Most-recently-used first. */
export function sortByRecent(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/** Build a full `Agent` from connect-flow input. */
export function buildAgent(input: NewAgentInput, now: number = Date.now()): Agent {
  return {
    id: makeId(),
    name: input.name,
    framework: input.framework,
    transport: input.transport,
    baseUrl: input.baseUrl,
    capabilities: input.capabilities ?? null,
    createdAt: now,
    lastUsedAt: now,
  };
}

/** Add or replace by id, keeping the list recency-ordered. */
export function upsertAgent(agents: Agent[], agent: Agent): Agent[] {
  const without = agents.filter((a) => a.id !== agent.id);
  return sortByRecent([...without, agent]);
}

export function removeAgent(agents: Agent[], id: string): Agent[] {
  return agents.filter((a) => a.id !== id);
}

/** Bump `lastUsedAt` and re-sort; no-op if the id is absent. */
export function touchAgent(agents: Agent[], id: string, when: number = Date.now()): Agent[] {
  return sortByRecent(
    agents.map((a) => (a.id === id ? { ...a, lastUsedAt: when } : a)),
  );
}

/**
 * Resolve the active agent: the requested id if present, else the most recent,
 * else null. Keeps the app pointed at a real agent after a delete/restart.
 */
export function resolveActive(agents: Agent[], activeId: string | null): Agent | null {
  if (agents.length === 0) return null;
  if (activeId) {
    const found = agents.find((a) => a.id === activeId);
    if (found) return found;
  }
  return sortByRecent(agents)[0];
}
