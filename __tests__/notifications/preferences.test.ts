import { InMemoryRepository } from '@/db/memory';
import {
  DEFAULT_NOTIFICATION_MODE,
  getNotificationMode,
  setNotificationMode,
} from '@/notifications/preferences';

describe('notification preferences', () => {
  it('defaults each agent to all activity', async () => {
    const repo = new InMemoryRepository();
    await expect(getNotificationMode(repo, 'agent-a')).resolves.toBe(DEFAULT_NOTIFICATION_MODE);
  });

  it('persists each agent preference independently', async () => {
    const repo = new InMemoryRepository();
    await setNotificationMode(repo, 'agent-a', 'attention');
    await setNotificationMode(repo, 'agent-b', 'off');

    await expect(getNotificationMode(repo, 'agent-a')).resolves.toBe('attention');
    await expect(getNotificationMode(repo, 'agent-b')).resolves.toBe('off');
  });

  it('falls back safely when metadata is not a valid mode', async () => {
    const repo = new InMemoryRepository();
    await repo.setMeta('notification_mode:agent-a', 'unexpected');

    await expect(getNotificationMode(repo, 'agent-a')).resolves.toBe(DEFAULT_NOTIFICATION_MODE);
  });
});
