/**
 * Per-agent push preferences. These are non-secret, on-device settings: the
 * relay receives the selected mode whenever its app connection is refreshed,
 * but the preference itself never needs to leave SQLite.
 */

import type { Repository } from '@/db';

export type NotificationMode = 'all' | 'attention' | 'off';

export const DEFAULT_NOTIFICATION_MODE: NotificationMode = 'all';

function keyFor(agentId: string): string {
  return `notification_mode:${agentId}`;
}

function isNotificationMode(value: string | null): value is NotificationMode {
  return value === 'all' || value === 'attention' || value === 'off';
}

/** Read a preference defensively, so older/corrupt metadata stays safe and useful. */
export async function getNotificationMode(
  repo: Repository,
  agentId: string,
): Promise<NotificationMode> {
  const value = await repo.getMeta(keyFor(agentId));
  return isNotificationMode(value) ? value : DEFAULT_NOTIFICATION_MODE;
}

/** Save a preference for one agent. It is applied at the next relay connection. */
export async function setNotificationMode(
  repo: Repository,
  agentId: string,
  mode: NotificationMode,
): Promise<void> {
  await repo.setMeta(keyFor(agentId), mode);
}
