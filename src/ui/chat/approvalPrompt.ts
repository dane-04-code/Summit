import type { Message } from './types';

export type ApprovalCommand =
  | '/approve'
  | '/approve session'
  | '/approve always'
  | '/deny';

export type ApprovalOption = {
  command: ApprovalCommand;
  label: string;
  detail: string;
};

const OPTIONS: ApprovalOption[] = [
  { command: '/approve', label: 'Approve once', detail: 'This command' },
  { command: '/approve session', label: 'This session', detail: 'Matching commands' },
  { command: '/approve always', label: 'Always allow', detail: 'Future sessions' },
  { command: '/deny', label: 'Deny', detail: 'Do not run it' },
];

const COMMAND_RE = /\/(?:approve(?:\s+(?:session|always))?|deny)\b/gi;
const ACTIVE_APPROVAL_RE =
  /\b(?:approval\s+(?:is\s+)?(?:required|needed|requested|pending)|requires?\s+(?:your\s+)?approval|(?:waiting|awaiting)\s+for\s+(?:your\s+)?approval|dangerous\s+command)\b/i;

export function approvalCommand(value: string): ApprovalCommand | null {
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  return OPTIONS.some((option) => option.command === normalized)
    ? (normalized as ApprovalCommand)
    : null;
}

export function isApprovalCommand(value: string): value is ApprovalCommand {
  return approvalCommand(value) !== null;
}

export type ApprovalPrompt = {
  body: string;
  command?: string;
  options: ApprovalOption[];
};

function extractCommandSnippet(source: string): { body: string; command?: string } {
  const fenced = source.match(/(?:^|\n)```(?:bash|sh|shell|zsh|text)?[ \t]*\n([\s\S]*?)\n```(?=\n|$)/i);
  const inline = fenced ? null : source.match(/^\s*`([^`\r\n]+)`\s*$/m);
  const match = fenced ?? inline;
  if (!match) return { body: source };

  const command = match[1].trim();
  if (!command) return { body: source };
  const body = source
    .replace(match[0], '')
    .replace(/^\s*(?:command|run)\s*:\s*$/im, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { body, command };
}

/**
 * Detect Hermes' messaging fallback prompt without treating ordinary docs that
 * mention slash commands as an active approval. Hermes remains the authority:
 * these controls submit the exact commands already offered by the agent.
 */
export function parseApprovalPrompt(source: string): ApprovalPrompt | null {
  if (!ACTIVE_APPROVAL_RE.test(source)) return null;

  const found = new Set<ApprovalCommand>();
  for (const match of source.matchAll(COMMAND_RE)) {
    const command = approvalCommand(match[0]);
    if (command) found.add(command);
  }
  if (!found.has('/approve') || !found.has('/deny')) return null;

  let removedOptionLine = false;
  const bodyLines = source.split(/\r?\n/).filter((line) => {
    COMMAND_RE.lastIndex = 0;
    if (!COMMAND_RE.test(line)) return true;
    removedOptionLine = true;
    return false;
  });

  if (!removedOptionLine) return null;

  const cleanedBody = bodyLines
    .filter((line, index, lines) => {
      if (!/^\s*(?:reply|respond|type|choose|select)(?:\s+(?:with(?:\s+one(?:\s+of)?)?|one(?:\s+of)?|an\s+option))?\s*:?\s*$/i.test(line)) {
        return true;
      }
      return index !== lines.length - 1;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const { body, command } = extractCommandSnippet(cleanedBody);

  return {
    body,
    command,
    options: OPTIONS.filter((option) => found.has(option.command)),
  };
}

/** Rebuild resolved button state from the persisted transcript after restart. */
export function approvalResolutions(messages: Message[]): Map<string, ApprovalCommand> {
  const pending: string[] = [];
  const resolved = new Map<string, ApprovalCommand>();

  for (const message of messages) {
    if (
      message.role === 'agent' &&
      message.blocks.some(
        (block) => block.kind === 'markdown' && parseApprovalPrompt(block.source) !== null,
      )
    ) {
      pending.push(message.id);
      continue;
    }
    if (message.role !== 'user' || pending.length === 0) continue;
    const command = approvalCommand(message.text);
    if (!command) continue;
    const promptId = pending.pop();
    if (promptId) resolved.set(promptId, command);
  }

  return resolved;
}
