import { connectDirectAgent } from '@/agents/connect';
import { ConnectionError } from '@/agents/adapters/types';
import type { AgentCapabilities, AgentFramework } from '@/agents/types';

const hermesCaps: AgentCapabilities = {
  framework: 'hermes',
  hasRunApproval: true,
  hasRunStop: true,
  hasStreaming: true,
  hasJobs: false,
  hasSessions: true,
};

const openaiCaps: AgentCapabilities = {
  framework: 'openai',
  hasRunApproval: false,
  hasRunStop: false,
  hasStreaming: true,
  hasJobs: false,
  hasSessions: false,
  chatModel: 'llama3',
};

/**
 * Fake adapter factory routing on the transient agent's framework — mirrors
 * the real factory. Each probe fn is what testConnection resolves/rejects with.
 */
function fakeMake(probes: Partial<Record<AgentFramework, () => Promise<AgentCapabilities>>>) {
  return ((agent: { framework: AgentFramework }) => ({
    testConnection:
      probes[agent.framework] ??
      (() => Promise.reject(new Error(`no probe for ${agent.framework}`))),
  })) as unknown as typeof import('@/agents/adapters').makeAdapter;
}

describe('connectDirectAgent', () => {
  it('returns a Hermes agent when the capabilities probe succeeds', async () => {
    const out = await connectDirectAgent(
      { name: 'Home', host: 'agent.example.com:8642', apiKey: 'sk-1' },
      { makeAdapter: fakeMake({ hermes: async () => hermesCaps }) },
    );
    expect(out.secret).toBe('sk-1');
    expect(out.input).toMatchObject({
      name: 'Home',
      framework: 'hermes',
      transport: 'direct',
      baseUrl: 'agent.example.com:8642',
      capabilities: hermesCaps,
    });
  });

  it('defaults a blank name to "Hermes" and trims the host', async () => {
    const out = await connectDirectAgent(
      { name: '   ', host: '  10.0.0.5:8642  ', apiKey: 'k' },
      { makeAdapter: fakeMake({ hermes: async () => hermesCaps }) },
    );
    expect(out.input.name).toBe('Hermes');
    expect(out.input.baseUrl).toBe('10.0.0.5:8642');
  });

  it('falls back to the generic OpenAI probe when the server is not Hermes', async () => {
    const out = await connectDirectAgent(
      { name: '', host: 'localhost:11434', apiKey: 'k' },
      {
        makeAdapter: fakeMake({
          hermes: async () => {
            throw new ConnectionError('wrong-shape', 'not hermes');
          },
          openai: async () => openaiCaps,
        }),
      },
    );
    expect(out.input).toMatchObject({
      name: 'Agent',
      framework: 'openai',
      transport: 'direct',
      capabilities: openaiCaps,
    });
  });

  it('does not fall back when the server is unreachable', async () => {
    const openaiProbe = jest.fn(async () => openaiCaps);
    await expect(
      connectDirectAgent(
        { name: '', host: 'h:8642', apiKey: 'k' },
        {
          makeAdapter: fakeMake({
            hermes: async () => {
              throw new ConnectionError('unreachable', 'no route');
            },
            openai: openaiProbe,
          }),
        },
      ),
    ).rejects.toMatchObject({ kind: 'unreachable' });
    expect(openaiProbe).not.toHaveBeenCalled();
  });

  it('does not fall back when the key is rejected', async () => {
    await expect(
      connectDirectAgent(
        { name: '', host: 'h:8642', apiKey: 'bad' },
        {
          makeAdapter: fakeMake({
            hermes: async () => {
              throw new ConnectionError('unauthorized', 'key rejected');
            },
            openai: async () => openaiCaps,
          }),
        },
      ),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('reports a neutral wrong-shape error when neither probe recognizes the server', async () => {
    await expect(
      connectDirectAgent(
        { name: '', host: 'h:80', apiKey: 'k' },
        {
          makeAdapter: fakeMake({
            hermes: async () => {
              throw new ConnectionError('wrong-shape', 'not hermes');
            },
            openai: async () => {
              throw new ConnectionError('wrong-shape', 'not openai');
            },
          }),
        },
      ),
    ).rejects.toMatchObject({
      kind: 'wrong-shape',
      message: expect.stringContaining('supported agent API'),
    });
  });

  it('surfaces an unauthorized error from the generic probe', async () => {
    await expect(
      connectDirectAgent(
        { name: '', host: 'h:80', apiKey: 'bad' },
        {
          makeAdapter: fakeMake({
            hermes: async () => {
              throw new ConnectionError('wrong-shape', 'not hermes');
            },
            openai: async () => {
              throw new ConnectionError('unauthorized', 'key rejected');
            },
          }),
        },
      ),
    ).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
