/**
 * Session mutations behind the sidebar's long-press actions. Pure repo logic,
 * kept out of the screen so it is unit-testable.
 */

import type { Repository } from '@/db/repository';

/** Rename a session (trimmed). Returns false for empty titles or unknown ids. */
export async function renameSession(
  repo: Repository,
  sessionId: string,
  title: string,
): Promise<boolean> {
  const trimmed = title.trim();
  if (!trimmed) return false;
  const session = await repo.getSession(sessionId);
  if (!session) return false;
  await repo.upsertSession({ ...session, title: trimmed, updatedAt: Date.now() });
  return true;
}
