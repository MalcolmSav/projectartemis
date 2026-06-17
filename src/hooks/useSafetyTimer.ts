import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification, cancelLocalNotification } from '../lib/notifications';

const KEY = 'artemis.safety_timer';
const NOTIF_KEY = 'artemis.safety_timer_notif';

/**
 * Dead-man's-switch timer. The user starts a countdown ("alert my circle if I
 * don't confirm I'm safe in N minutes"). On expiry it flips `expired` true; the
 * consumer is responsible for raising the alarm. A local notification also fires
 * at expiry so the user is nudged even if the app is closed.
 */
export function useSafetyTimer() {
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [expired, setExpired] = useState(false);
  const notifIdRef = useRef<string | null>(null);

  // Restore on mount.
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (!v) return;
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        setExpiresAt(d);
        if (Date.now() >= d.getTime()) setExpired(true);
      }
    });
    AsyncStorage.getItem(NOTIF_KEY).then((v) => {
      if (v) notifIdRef.current = v;
    });
  }, []);

  // Tick once a second while a timer is active.
  useEffect(() => {
    if (!expiresAt) return;
    const check = () => {
      if (Date.now() >= expiresAt.getTime()) setExpired(true);
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const start = useCallback(async (durationMs: number) => {
    const exp = new Date(Date.now() + durationMs);
    await cancelLocalNotification(notifIdRef.current);
    const notifId = await scheduleLocalNotification({
      title: '⏰ Safety timer expired',
      body: "Open Artemis and confirm you're safe — your circle is about to be alerted.",
      date: exp,
      data: { type: 'safety_timer' },
    });
    notifIdRef.current = notifId;
    await AsyncStorage.setItem(KEY, exp.toISOString());
    if (notifId) await AsyncStorage.setItem(NOTIF_KEY, notifId);
    else await AsyncStorage.removeItem(NOTIF_KEY);
    setExpiresAt(exp);
    setExpired(false);
  }, []);

  /** Cancel the timer (user confirmed safe, or alarm already raised). */
  const clear = useCallback(async () => {
    await cancelLocalNotification(notifIdRef.current);
    notifIdRef.current = null;
    await AsyncStorage.removeItem(KEY);
    await AsyncStorage.removeItem(NOTIF_KEY);
    setExpiresAt(null);
    setExpired(false);
  }, []);

  return { expiresAt, expired, start, clear };
}
