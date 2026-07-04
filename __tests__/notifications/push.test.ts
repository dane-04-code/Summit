/**
 * Push is an enhancement with hard environment gates: Expo Go (which removed
 * remote push in SDK 53+ and errors on import), web, simulators, and denied
 * permission must all degrade to null without touching expo-notifications.
 */

jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'bare',
    expoConfig: { extra: { eas: { projectId: 'proj-1' } } },
  },
}));

import { resolvePushToken, initNotificationHandling } from '@/notifications/push';

const Notifications = jest.requireMock('expo-notifications');
const Constants = jest.requireMock('expo-constants').default;

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
  Constants.executionEnvironment = 'bare';
});

describe('resolvePushToken', () => {
  it('returns the Expo token on a device with permission', async () => {
    await expect(resolvePushToken()).resolves.toBe('ExponentPushToken[test]');
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('never touches expo-notifications inside Expo Go', async () => {
    Constants.executionEnvironment = 'storeClient';
    await expect(resolvePushToken()).resolves.toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await expect(resolvePushToken()).resolves.toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});

describe('initNotificationHandling', () => {
  it('sets the foreground handler in a dev build', async () => {
    initNotificationHandling();
    await flush();
    expect(Notifications.setNotificationHandler).toHaveBeenCalled();
  });

  it('does nothing inside Expo Go', async () => {
    Constants.executionEnvironment = 'storeClient';
    initNotificationHandling();
    await flush();
    expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
  });
});
