import {
  approvalResolutions,
  isApprovalCommand,
  parseApprovalPrompt,
} from '@/ui/chat/approvalPrompt';
import type { Message } from '@/ui/chat/types';

describe('parseApprovalPrompt', () => {
  it('extracts only commands Hermes offered and preserves the command context', () => {
    const prompt = [
      'Approval is required before running:',
      '',
      '`git push origin main`',
      '',
      'Reply with one of:',
      '- /approve',
      '- /approve session',
      '- /approve always',
      '- /deny',
    ].join('\n');

    expect(parseApprovalPrompt(prompt)).toEqual({
      body: 'Approval is required before running:',
      command: 'git push origin main',
      options: [
        { command: '/approve', label: 'Approve once', detail: 'This command' },
        { command: '/approve session', label: 'This session', detail: 'Matching commands' },
        { command: '/approve always', label: 'Always allow', detail: 'Future sessions' },
        { command: '/deny', label: 'Deny', detail: 'Do not run it' },
      ],
    });
  });

  it('does not turn documentation that mentions approval commands into live controls', () => {
    const docs = 'Approval docs: type `/approve` to allow and `/deny` to reject.';
    expect(parseApprovalPrompt(docs)).toBeNull();
  });

  it('requires both the approve and deny choices', () => {
    expect(parseApprovalPrompt('Approval required. Reply with /approve.')).toBeNull();
  });

  it('extracts a fenced shell command for the scrollable approval snippet', () => {
    const prompt = [
      'Approval needed to continue.',
      '```bash',
      'docker compose run --rm worker ./scripts/a-very-long-command --with-many-flags',
      '```',
      'Reply with /approve or /deny.',
    ].join('\n');

    expect(parseApprovalPrompt(prompt)).toMatchObject({
      body: 'Approval needed to continue.',
      command: 'docker compose run --rm worker ./scripts/a-very-long-command --with-many-flags',
    });
  });
});

describe('isApprovalCommand', () => {
  it('accepts only complete supported commands', () => {
    expect(isApprovalCommand('/approve session')).toBe(true);
    expect(isApprovalCommand('/deny')).toBe(true);
    expect(isApprovalCommand('/approve everything')).toBe(false);
  });
});

describe('approvalResolutions', () => {
  it('restores a sent decision from the persisted user command', () => {
    const messages: Message[] = [
      {
        id: 'prompt-1',
        role: 'agent',
        blocks: [{
          kind: 'markdown',
          source: 'Dangerous command requires approval. Reply with /approve or /deny.',
        }],
      },
      { id: 'decision-1', role: 'user', text: '/approve session' },
    ];

    expect(approvalResolutions(messages).get('prompt-1')).toBe('/approve session');
  });
});
