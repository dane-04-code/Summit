/**
 * App-owned agent-profile vocabulary.
 *
 * A future native plugin may supply an `AgentProfileSnapshot`, but it only
 * supplies bounded facts. Summit remains the sole owner of layout, labels,
 * and actions. Until then we build the profile from the paired agent's real
 * identity and capability snapshot.
 */

import type { Agent } from '@/agents/types';
import { frameworkLabel } from '@/agents/frameworks';

export type AgentProfileEntry = {
  id: string;
  name: string;
  summary?: string;
};

/**
 * Reserved for the native-plugin profile event. Do not populate this from an
 * LLM reply: skills and tools must come from a verified host-side source.
 */
export type AgentProfileSnapshot = {
  revision: string;
  updatedAt: number;
  skills: AgentProfileEntry[];
  tools: AgentProfileEntry[];
};

export type CapabilityItem = {
  id: string;
  label: string;
  detail: string;
  available: boolean;
};

export function profileCapabilities(agent: Agent): CapabilityItem[] {
  const capabilities = agent.capabilities;
  return [
    {
      id: 'streaming',
      label: 'Streaming replies',
      detail: 'Live draft replies in Summit',
      available: capabilities?.hasStreaming ?? false,
    },
    {
      id: 'approvals',
      label: 'Action approvals',
      detail: 'Can request a decision for supported work',
      available: capabilities?.hasRunApproval ?? false,
    },
    {
      id: 'stop',
      label: 'Stop active work',
      detail: 'Can stop a supported in-flight run',
      available: capabilities?.hasRunStop ?? false,
    },
    {
      id: 'jobs',
      label: 'Scheduled work',
      detail: 'Can manage supported scheduled jobs',
      available: capabilities?.hasJobs ?? false,
    },
  ];
}

export function agentProfileSubtitle(agent: Agent): string {
  return `${frameworkLabel(agent.framework)} · ${agent.transport === 'relay' ? 'Relay' : 'Direct'}`;
}
