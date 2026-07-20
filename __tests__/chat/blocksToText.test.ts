import { blocksToText, messageToText, type AgentBlock, type Message } from '@/ui/chat/types';

describe('blocksToText', () => {
  it('joins mixed blocks as readable plain text', () => {
    const blocks: AgentBlock[] = [
      { kind: 'heading', text: 'Deploy status' },
      { kind: 'text', spans: [{ text: 'All ' }, { text: 'green', code: true }] },
      { kind: 'activity', label: 'Running tests…' },
      { kind: 'code', lines: [{ segments: [{ text: 'npm run deploy' }] }] },
      { kind: 'markdown', source: '## Next steps' },
    ];
    expect(blocksToText(blocks)).toBe(
      'Deploy status\n\nAll green\n\nnpm run deploy\n\n## Next steps',
    );
  });

  it('skips empty blocks and uses file source for file blocks', () => {
    const blocks: AgentBlock[] = [
      { kind: 'markdown', source: '   ' },
      { kind: 'file', file: { name: 'a.md', source: '# Doc', sizeLabel: '5 B', lineCount: 1 } },
    ];
    expect(blocksToText(blocks)).toBe('# Doc');
  });
});

describe('messageToText', () => {
  it('handles all three roles', () => {
    const user: Message = { id: '1', role: 'user', text: 'hi' };
    const action: Message = {
      id: '2',
      role: 'action',
      runId: 'run_2',
      title: 'Run?',
      command: 'rm -rf /tmp/x',
    };
    const agent: Message = {
      id: '3',
      role: 'agent',
      blocks: [{ kind: 'markdown', source: 'Done.' }],
    };
    expect(messageToText(user)).toBe('hi');
    expect(messageToText(action)).toBe('Run?\nrm -rf /tmp/x');
    expect(messageToText(agent)).toBe('Done.');
  });
});
