import type { Agent } from '@/agents/types';
import { agentProfileSubtitle, profileCapabilities } from '@/ui/agentProfile/profile';

const agent: Agent = {
  id: 'agent_1',
  name: 'Hermes',
  framework: 'hermes',
  transport: 'relay',
  baseUrl: null,
  capabilities: {
    framework: 'hermes',
    hasRunApproval: true,
    hasRunStop: true,
    hasStreaming: true,
    hasJobs: false,
    hasSessions: true,
    serverVersion: '0.8.0',
  },
  createdAt: 1,
  lastUsedAt: 2,
};

describe('agent profile presentation', () => {
  it('uses the paired agent metadata rather than invented profile data', () => {
    expect(agentProfileSubtitle(agent)).toBe('Hermes · Relay');
    expect(profileCapabilities(agent)).toEqual([
      expect.objectContaining({ id: 'streaming', available: true }),
      expect.objectContaining({ id: 'approvals', available: true }),
      expect.objectContaining({ id: 'stop', available: true }),
      expect.objectContaining({ id: 'jobs', available: false }),
    ]);
  });
});
