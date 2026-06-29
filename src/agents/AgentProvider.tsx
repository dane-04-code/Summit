/**
 * The live agent registry. On boot it rehydrates from the on-device store so a
 * configured agent (and the chat that goes with it) survives an app restart —
 * the source of truth is SQLite + Keychain, never this React state.
 * See `docs/AGENTS.md` §6.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import type { Agent, NewAgentInput } from './types';
import { buildAgent, removeAgent as removeFromList, resolveActive, touchAgent, upsertAgent } from './registry';
import { deleteAgentSecret, setAgentSecret } from './secrets';
import { makeAdapter } from './adapters';
import type { AgentAdapter } from './adapters/types';
import { getRepository, type Repository } from '@/db';

const ACTIVE_KEY = 'active_agent_id';

type AgentContextValue = {
  /** False until the first rehydrate finishes — gates UI that needs agents. */
  ready: boolean;
  agents: Agent[];
  activeAgent: Agent | null;
  /** Persist a new agent + its secret, make it active, return it. */
  addAgent: (input: NewAgentInput, secret: string) => Promise<Agent>;
  removeAgent: (id: string) => Promise<void>;
  selectAgent: (id: string) => Promise<void>;
  /** Build the adapter for an agent (lazy Keychain read for its secret). */
  adapterFor: (agent: Agent) => AgentAdapter;
  /** The persistence layer, for sessions + saved messages. */
  repo: Repository;
};

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  // Lazy state init holds the singleton store stably without a ref read in render.
  const [repo] = useState(getRepository);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await repo.init();
        const [loaded, savedActive] = await Promise.all([
          repo.listAgents(),
          repo.getMeta(ACTIVE_KEY),
        ]);
        if (cancelled) return;
        setAgents(loaded);
        setActiveId(resolveActive(loaded, savedActive)?.id ?? null);
      } catch (err) {
        // A store failure must not brick the app — start empty; the user can
        // re-add an agent, and nothing sensitive was lost (Hermes holds it).
        console.warn('[agents] rehydrate failed, starting empty', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const addAgent = async (input: NewAgentInput, secret: string): Promise<Agent> => {
    const agent = buildAgent(input);
    await setAgentSecret(agent.id, secret);
    await repo.upsertAgent(agent);
    await repo.setMeta(ACTIVE_KEY, agent.id);
    setAgents((prev) => upsertAgent(prev, agent));
    setActiveId(agent.id);
    return agent;
  };

  const removeAgent = async (id: string): Promise<void> => {
    await deleteAgentSecret(id);
    await repo.deleteAgent(id);
    const next = removeFromList(agents, id);
    const nextActive = activeId === id ? (resolveActive(next, null)?.id ?? null) : activeId;
    if (nextActive !== activeId) {
      if (nextActive) await repo.setMeta(ACTIVE_KEY, nextActive);
      setActiveId(nextActive);
    }
    setAgents(next);
  };

  const selectAgent = async (id: string): Promise<void> => {
    const now = Date.now();
    const target = agents.find((a) => a.id === id);
    if (!target) return;
    await repo.upsertAgent({ ...target, lastUsedAt: now });
    await repo.setMeta(ACTIVE_KEY, id);
    setAgents((prev) => touchAgent(prev, id, now));
    setActiveId(id);
  };

  const adapterCache = useRef<Map<string, AgentAdapter>>(new Map());

  const adapterFor = (agent: Agent): AgentAdapter => {
    const cached = adapterCache.current.get(agent.id);
    if (cached) return cached;
    const adapter = makeAdapter(agent);
    adapterCache.current.set(agent.id, adapter);
    return adapter;
  };

  const value: AgentContextValue = {
    ready,
    agents,
    activeAgent: resolveActive(agents, activeId),
    addAgent,
    removeAgent,
    selectAgent,
    adapterFor,
    repo,
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgents(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgents must be used within an AgentProvider');
  return ctx;
}
