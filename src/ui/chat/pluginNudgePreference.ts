/**
 * Per-agent dismiss state for the plugin-install nudge banner. Non-secret,
 * on-device only — same pattern as notification preferences.
 */

import type { Repository } from '@/db';

function keyFor(agentId: string): string {
  return `plugin_nudge_dismissed:${agentId}`;
}

export async function isPluginNudgeDismissed(repo: Repository, agentId: string): Promise<boolean> {
  return (await repo.getMeta(keyFor(agentId))) === '1';
}

export async function dismissPluginNudge(repo: Repository, agentId: string): Promise<void> {
  await repo.setMeta(keyFor(agentId), '1');
}
