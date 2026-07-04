/**
 * The slash-command registry: a static table plus two pure functions that the
 * composer uses to decide when to show the `/` menu and what to put in it.
 *
 * A command is either 'app' (handled in the client — never sent) or 'agent'
 * (literal text inserted into the composer and sent to the agent, which parses
 * the `/` itself). Gated commands appear only when the active agent's
 * capabilities allow — the same capability-driven UI the rest of the app uses.
 */

import type { AgentCapabilities } from '@/agents/types';

export type AppCommandId = 'new' | 'clear' | 'settings';

/** The boolean capability flags a command may gate on. */
export type CapabilityFlag =
  | 'hasRunApproval'
  | 'hasRunStop'
  | 'hasStreaming'
  | 'hasJobs'
  | 'hasSessions';

export type SlashCommand =
  | { name: string; description: string; scope: 'app'; action: AppCommandId; gate?: CapabilityFlag }
  | { name: string; description: string; scope: 'agent'; send: string; gate?: CapabilityFlag };

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: 'new', description: 'Start a new chat', scope: 'app', action: 'new' },
  { name: 'clear', description: 'Clear this thread', scope: 'app', action: 'clear' },
  { name: 'settings', description: 'Open settings', scope: 'app', action: 'settings' },
  { name: 'cron', description: 'Ask the agent about scheduled jobs', scope: 'agent', send: '/cron ', gate: 'hasJobs' },
];

/**
 * The command token when `input` is a slash query (a slash at position 0
 * followed by word chars, no space yet), else null. `'/'` → `''`, `'/ne'` →
 * `'ne'`, `'/cron list'` → null.
 */
export function slashQuery(input: string): string | null {
  const match = /^\/(\w*)$/.exec(input);
  return match ? match[1] : null;
}

/** Commands matching the current input, respecting capability gates. */
export function matchCommands(
  input: string,
  capabilities: AgentCapabilities | null,
): SlashCommand[] {
  const query = slashQuery(input);
  if (query === null) return [];
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => {
    if (cmd.gate && !capabilities?.[cmd.gate]) return false;
    return cmd.name.toLowerCase().startsWith(q);
  });
}
