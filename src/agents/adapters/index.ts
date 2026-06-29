import type { Agent } from '../types';
import { getAgentSecret } from '../secrets';
import type { AgentAdapter } from './types';
import { HermesAdapter } from './hermes';
import { OpenClawAdapter } from './openclaw';
import { RelayAdapter } from './relay';

export function makeAdapter(
  agent: Agent,
  getSecret: () => Promise<string | null> = () => getAgentSecret(agent.id),
): AgentAdapter {
  if (agent.transport === 'relay') {
    return new RelayAdapter(agent, getSecret);
  }
  switch (agent.framework) {
    case 'hermes':
      return new HermesAdapter(agent, getSecret);
    case 'openclaw':
      return new OpenClawAdapter();
  }
}

export * from './types';
