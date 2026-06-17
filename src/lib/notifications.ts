import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show banner + sound even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Ensure we have local-notification permission and an Android channel.
 * Local notifications work WITHOUT an Apple Developer account / APNs — this is
 * not remote push.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Artemis',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#D4A933',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Schedule a one-off local notification for a future date. Returns its id. */
export async function scheduleLocalNotification(opts: {
  title: string;
  body: string;
  date: Date;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  if (opts.date.getTime() <= Date.now()) return null;
  const ok = await ensureNotificationPermissions();
  if (!ok) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: opts.title, body: opts.body, sound: 'default', data: opts.data ?? {} },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: opts.date },
    });
  } catch {
    return null;
  }
}

/** Fire a local notification immediately (e.g. a wellness check just arrived). */
export async function presentLocalNotification(opts: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const ok = await ensureNotificationPermissions();
  if (!ok) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: opts.title, body: opts.body, sound: 'default', data: opts.data ?? {} },
      trigger: null, // immediate
    });
  } catch {
    // best-effort
  }
}

/** Cancel a previously scheduled notification by id. */
export async function cancelLocalNotification(id: string | null | undefined): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or removed
  }
}
