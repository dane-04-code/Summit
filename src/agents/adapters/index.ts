import type { Agent } from '../types';
import { getAgentSecret } from '../secrets';
import type { AgentAdapter } from './types';
import { HermesAdapter } from './hermes';
import { OpenAICompatAdapter } from './openai';
import { OpenClawAdapter } from './openclaw';
import { RelayAdapter } from './relay';
import type { Repository } from '@/db';
import { getRepository } from '@/db';
import { getNotificationMode } from '@/notifications/preferences';

export function makeAdapter(
  agent: Agent,
  getSecret: () => Promise<string | null> = () => getAgentSecret(agent.id),
  repo: Repository = getRepository(),
): AgentAdapter {
  if (agent.transport === 'relay') {
    return new RelayAdapter(agent, getSecret, undefined, () => getNotificationMode(repo, agent.id));
  }
  switch (agent.framework) {
    case 'hermes':
      return new HermesAdapter(agent, getSecret);
    case 'openai':
      return new OpenAICompatAdapter(agent, getSecret);
    case 'openclaw':
      return new OpenClawAdapter();
  }
}

export * from './types';
