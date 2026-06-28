import { connectDirectAgent } from '@/agents/connect';
import { ConnectionError } from '@/agents/adapters/types';
import type { AgentCapabilities } from '@/agents/types';

const caps: AgentCapabilities = {
  framework: 'hermes',
  hasRunApproval: true,
  hasRunStop: true,
  hasStreaming: true,
  hasJobs: false,
  hasSessions: true,
};

// Fake adapter factory — ignores (agent, getSecret) and returns a stub whose
// only used method is testConnection.
function fakeMake(testConnection: () => Promise<AgentCapabilities>) {
  return (() => ({ testConnection })) as unknown as typeof import('@/agents/adapters').makeAdapter;
}

describe('connectDirectAgent', () => {
  it('returns input + secret with the capabilities snapshot on success', async () => {
    const out = await connectDirectAgent(
      { name: 'Home', host: 'agent.example.com:8642', apiKey: 'sk-1' },
      { makeAdapter: fakeMake(async () => caps) },
    );
    expect(out.secret).toBe('sk-1');
    expect(out.input).toMatchObject({
      name: 'Home',
      framework: 'hermes',
      transport: 'direct',
      baseUrl: 'agent.example.com:8642',
      capabilities: caps,
    });
  });

  it('defaults a blank name to "Hermes" and trims the host', async () => {
    const out = await connectDirectAgent(
      { name: '   ', host: '  10.0.0.5:8642  ', apiKey: 'k' },
      { makeAdapter: fakeMake(async () => caps) },
    );
    expect(out.input.name).toBe('Hermes');
    expect(out.input.baseUrl).toBe('10.0.0.5:8642');
  });

  it('propagates a ConnectionError so the screen can show its message', async () => {
    const make = fakeMake(async () => {
      throw new ConnectionError('unauthorized', 'key rejected');
    });
    await expect(
      connectDirectAgent({ name: 'x', host: 'h:8642', apiKey: 'bad' }, { makeAdapter: make }),
    ).rejects.toBeInstanceOf(ConnectionError);
  });
});
