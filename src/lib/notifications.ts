import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const PROJECT_ID = 'b28a3563-3015-4f10-9bc0-75610da26d85';

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

/**
 * Register this device's Expo push token with Supabase.
 * Must be called after the user is signed in. Safe to call multiple times —
 * it upserts. Does nothing on web or if permissions are denied.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const ok = await ensureNotificationPermissions();
    if (!ok) return;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? PROJECT_ID,
    });
    await supabase
      .from('profiles')
      .update({ push_token: tokenData.data })
      .eq('id', userId);
  } catch {
    // Simulator and Expo Go don't support remote push — fail silently.
    // Will retry next app launch on a real device.
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
