import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification, cancelLocalNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

const KEY = 'artemis.safety_timer';
const NOTIF_KEY = 'artemis.safety_timer_notif';

/**
 * Dead-man's-switch timer. The user starts a countdown ("alert my circle if I
 * don't confirm I'm safe in N minutes").
 *
 * The deadline is written to public.safety_timers so the server-side watchdog
 * owns the guarantee: it raises the alarm whether or not this app is running.
 * Everything here — the local mirror, the `expired` flag, the local
 * notification — is a fast path for the case where the phone is awake and in
 * the user's hand. It must never be the only thing standing between a missed
 * confirmation and an alert, which is what it used to be: a phone that locked
 * or ran out of battery simply never alerted anyone.
 */
export function useSafetyTimer() {
  const { user } = useAuth();
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [expired, setExpired] = useState(false);
  const notifIdRef = useRef<string | null>(null);

  // Restore on mount. The server row is authoritative — the device may have been
  // offline, reinstalled, or the timer started on another device.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [local, notifId] = await Promise.all([
        AsyncStorage.getItem(KEY),
        AsyncStorage.getItem(NOTIF_KEY),
      ]);
      if (cancelled) return;
      if (notifId) notifIdRef.current = notifId;

      let iso: string | null = local;
      if (user) {
        const { data } = await supabase
          .from('safety_timers')
          .select('expires_at, fired_at')
          .eq('user_id', user.id)
          .maybeSingle();
        if (cancelled) return;
        // Already fired server-side → the alarm has been raised; nothing to count
        // down to, and re-firing it locally would double-alert the circle.
        if (data && (data as any).fired_at) {
          await AsyncStorage.multiRemove([KEY, NOTIF_KEY]);
          return;
        }
        iso = (data as any)?.expires_at ?? null;
        if (iso) await AsyncStorage.setItem(KEY, iso);
        else await AsyncStorage.removeItem(KEY);
      }

      if (!iso) return;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return;
      setExpiresAt(d);
      if (Date.now() >= d.getTime()) setExpired(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // The row the watchdog scans. One timer per user, so a new one replaces the
    // old; fired_at resets so a previously-fired timer can't block this one.
    if (user) {
      await supabase
        .from('safety_timers')
        .upsert(
          { user_id: user.id, expires_at: exp.toISOString(), created_at: new Date().toISOString(), fired_at: null },
          { onConflict: 'user_id' },
        );
    }
    setExpiresAt(exp);
    setExpired(false);
  }, [user]);

  /**
   * Claim the right to raise the alarm for an expired timer. The app and the
   * watchdog both watch the same deadline, so whoever gets there first stamps
   * fired_at and the other backs off — otherwise an expiry the user witnessed
   * would alert the circle twice.
   *
   * Returns true if THIS device won the claim and should raise the alarm.
   */
  const claimExpiry = useCallback(async (): Promise<boolean> => {
    if (!user) return true; // offline / signed out — local alarm is all there is
    const { data, error } = await supabase
      .from('safety_timers')
      .update({ fired_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('fired_at', null)
      .select('user_id');
    // On a network error, prefer a duplicate alert over a missing one.
    if (error) return true;
    return (data?.length ?? 0) > 0;
  }, [user]);

  /** Cancel the timer (user confirmed safe, or alarm already raised). */
  const clear = useCallback(async () => {
    await cancelLocalNotification(notifIdRef.current);
    notifIdRef.current = null;
    await AsyncStorage.removeItem(KEY);
    await AsyncStorage.removeItem(NOTIF_KEY);
    // Delete server-side too, or the watchdog fires an alarm the user already
    // stood down.
    if (user) await supabase.from('safety_timers').delete().eq('user_id', user.id);
    setExpiresAt(null);
    setExpired(false);
  }, [user]);

  return { expiresAt, expired, start, clear, claimExpiry };
}
