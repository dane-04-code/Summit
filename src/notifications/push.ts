/**
 * Expo push token plumbing. Push is what makes the notification-driven model
 * work — the agent getting your attention at the gym — but it is always an
 * enhancement: Expo Go, web, simulators, denied permission, and missing EAS
 * config all resolve to null and the app carries on.
 *
 * expo-notifications is loaded with a lazy require behind a runtime gate:
 * Expo Go (SDK 53+) raises a visible error the moment the module is
 * evaluated, so it must never load there — and lazy require (unlike dynamic
 * import) also works under jest, keeping this logic testable.
 *
 * The token goes to the Summit relay (register_push frame), which POSTs to
 * the Expo Push API when the agent finishes a turn or sends a nudge while the
 * app is away. Notification content stays generic unless the agent explicitly
 * chooses a title/body — the transcript itself never transits push servers.
 */

import { Platform } from 'react-native';

function loadConstants() {
  return (require('expo-constants') as typeof import('expo-constants')).default;
}

/**
 * Whether this runtime can do push at all. Expo Go removed remote push in
 * SDK 53+ and errors on module evaluation, so it's gated before any require.
 */
function pushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return loadConstants().executionEnvironment !== 'storeClient';
  } catch {
    return false;
  }
}

/**
 * Ask for permission (if not yet decided) and return the Expo push token, or
 * null wherever push can't work. Safe to call repeatedly — registration is
 * idempotent and the permission dialog only ever shows once.
 */
export async function resolvePushToken(): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const Device = require('expo-device') as typeof import('expo-device');
    if (!Device.isDevice) return null; // simulators have no push tokens

    if (Platform.OS === 'android') {
      // Required on Android 13+ before permissions can be requested.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Agent notifications',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const projectId: string | undefined = loadConstants().expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Foreground behavior, set once at app start: no banner or sound while the
 * app is open — you're already looking at the thread. (Pushes only fire when
 * the app socket is down anyway; this covers races.)
 */
export function initNotificationHandling(): void {
  if (!pushSupported()) return;
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // push is an enhancement — carry on
  }
}
