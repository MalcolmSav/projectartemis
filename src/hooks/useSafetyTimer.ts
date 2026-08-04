import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleLocalNotification, cancelLocalNotification } from '../lib/notifications';
import { TIMER_GRACE_MS, TIMER_WARN_MS } from '../lib/constants';
import { isUnknownColumn } from './useCheckIns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

const KEY = 'artemis.safety_timer';
const NOTIF_KEY = 'artemis.safety_timer_notif';
const TARGETS_KEY = 'artemis.safety_timer_targets';

/** running → the deadline is still ahead; grace → it passed but nobody has been
 *  alerted yet; expired → the grace window is up and the alarm is due. */
export type TimerPhase = 'idle' | 'running' | 'grace' | 'expired';

function fmtClock(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Dead-man's-switch timer. The user starts a countdown ("alert my circle if I
 * don't confirm I'm safe in N minutes"), chooses who that alert goes to, and
 * gets warned before the deadline plus a grace window after it.
 *
 * The deadline is written to public.safety_timers so the server-side watchdog
 * owns the guarantee: it raises the alarm whether or not this app is running.
 * Everything here — the local mirror, the phase, the local notifications — is a
 * fast path for the case where the phone is awake and in the user's hand. It
 * must never be the only thing standing between a missed confirmation and an
 * alert, which is what it used to be: a phone that locked or ran out of battery
 * simply never alerted anyone.
 */
export function useSafetyTimer() {
  const { user } = useAuth();
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  /** Circle members to alert. Empty = the whole circle. */
  const [alertIds, setAlertIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const notifIdsRef = useRef<string[]>([]);

  // Restore on mount. The server row is authoritative — the device may have been
  // offline, reinstalled, or the timer started on another device.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [local, notifIds, targets] = await Promise.all([
        AsyncStorage.getItem(KEY),
        AsyncStorage.getItem(NOTIF_KEY),
        AsyncStorage.getItem(TARGETS_KEY),
      ]);
      if (cancelled) return;
      if (notifIds) {
        // Before the warning/grace notifications this key held a single bare id,
        // which is not valid JSON — and an upgrade must still be able to cancel it.
        let parsed: unknown;
        try {
          parsed = JSON.parse(notifIds);
        } catch {
          parsed = null;
        }
        notifIdsRef.current = Array.isArray(parsed) ? (parsed as string[]) : [notifIds];
      }
      let ids: string[] = [];
      try {
        ids = targets ? JSON.parse(targets) : [];
      } catch {
        ids = [];
      }

      let iso: string | null = local;
      if (user) {
        let { data, error } = await supabase
          .from('safety_timers')
          .select('expires_at, fired_at, alert_ids')
          .eq('user_id', user.id)
          .maybeSingle();
        // Pre-migration database: read what does exist rather than losing the
        // running timer entirely, and keep the targets from AsyncStorage.
        if (error && isUnknownColumn(error)) {
          ({ data } = await supabase
            .from('safety_timers')
            .select('expires_at, fired_at')
            .eq('user_id', user.id)
            .maybeSingle());
        }
        if (cancelled) return;
        // Already fired server-side → the alarm has been raised; nothing to count
        // down to, and re-firing it locally would double-alert the circle.
        if (data && (data as any).fired_at) {
          await AsyncStorage.multiRemove([KEY, NOTIF_KEY, TARGETS_KEY]);
          return;
        }
        iso = (data as any)?.expires_at ?? null;
        // `alert_ids` is missing until the migration runs; fall back to the
        // device's own copy rather than silently widening the alert to everyone.
        if (data && Array.isArray((data as any).alert_ids)) ids = (data as any).alert_ids;
        if (iso) await AsyncStorage.setItem(KEY, iso);
        else await AsyncStorage.removeItem(KEY);
      }

      if (!iso) return;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return;
      setExpiresAt(d);
      setAlertIds(ids);
    })();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick once a second while a timer is active, moving it through the phases.
  useEffect(() => {
    if (!expiresAt) {
      setPhase('idle');
      return;
    }
    const check = () => {
      const left = expiresAt.getTime() - Date.now();
      setPhase(left > 0 ? 'running' : left > -TIMER_GRACE_MS ? 'grace' : 'expired');
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  /** Wipe every pending local notification this timer scheduled. */
  const cancelNotifs = useCallback(async () => {
    await Promise.all(notifIdsRef.current.map((id) => cancelLocalNotification(id)));
    notifIdsRef.current = [];
  }, []);

  /**
   * Three notifications, because the useful moments are before the deadline, at
   * it, and never after — by the time the alarm goes out the push comes from the
   * server anyway.
   */
  const scheduleNotifs = useCallback(async (exp: Date) => {
    const ids: (string | null)[] = await Promise.all([
      scheduleLocalNotification({
        title: '⏰ Check-in due soon',
        body: `Your circle is alerted at ${fmtClock(exp)} unless you confirm you're safe.`,
        date: new Date(exp.getTime() - TIMER_WARN_MS),
        data: { type: 'safety_timer_warning' },
      }),
      scheduleLocalNotification({
        title: "⏰ Time's up — are you safe?",
        body: `Tap "I'm safe" in the next ${Math.round(TIMER_GRACE_MS / 60000)} minutes or your circle is alerted.`,
        date: exp,
        data: { type: 'safety_timer' },
      }),
      scheduleLocalNotification({
        title: '🚨 Alerting your circle',
        body: 'You did not confirm you are safe, so the people you chose are being alerted.',
        date: new Date(exp.getTime() + TIMER_GRACE_MS),
        data: { type: 'safety_timer_fired' },
      }),
    ]);
    notifIdsRef.current = ids.filter(Boolean) as string[];
    if (notifIdsRef.current.length > 0) {
      await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(notifIdsRef.current));
    } else {
      await AsyncStorage.removeItem(NOTIF_KEY);
    }
  }, []);

  /**
   * @param durationMs how long until the deadline
   * @param targetIds  circle member ids to alert; empty = the whole circle
   */
  const start = useCallback(async (durationMs: number, targetIds: string[] = []) => {
    const exp = new Date(Date.now() + durationMs);
    await cancelNotifs();
    await scheduleNotifs(exp);
    await AsyncStorage.setItem(KEY, exp.toISOString());
    await AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targetIds));
    // The row the watchdog scans. One timer per user, so a new one replaces the
    // old; fired_at resets so a previously-fired timer can't block this one.
    if (user) {
      const base = {
        user_id: user.id,
        expires_at: exp.toISOString(),
        created_at: new Date().toISOString(),
        fired_at: null,
      };
      const { error } = await supabase
        .from('safety_timers')
        .upsert({ ...base, alert_ids: targetIds }, { onConflict: 'user_id' });
      // Without the column the watchdog can't honour the choice, but a timer the
      // server doesn't know about is the far worse failure — write it anyway.
      if (error && isUnknownColumn(error)) {
        await supabase.from('safety_timers').upsert(base, { onConflict: 'user_id' });
      }
    }
    setAlertIds(targetIds);
    setExpiresAt(exp);
  }, [user, cancelNotifs, scheduleNotifs]);

  /** Push the deadline out — "I'm fine, I just need longer". */
  const extend = useCallback(async (extraMs: number) => {
    const exp = new Date(Date.now() + extraMs);
    await cancelNotifs();
    await scheduleNotifs(exp);
    await AsyncStorage.setItem(KEY, exp.toISOString());
    if (user) {
      await supabase
        .from('safety_timers')
        .update({ expires_at: exp.toISOString(), fired_at: null })
        .eq('user_id', user.id);
    }
    setExpiresAt(exp);
  }, [user, cancelNotifs, scheduleNotifs]);

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
    await cancelNotifs();
    await AsyncStorage.multiRemove([KEY, NOTIF_KEY, TARGETS_KEY]);
    // Delete server-side too, or the watchdog fires an alarm the user already
    // stood down.
    if (user) await supabase.from('safety_timers').delete().eq('user_id', user.id);
    setExpiresAt(null);
    setAlertIds([]);
    setPhase('idle');
  }, [user, cancelNotifs]);

  return {
    expiresAt,
    alertIds,
    phase,
    /** The grace window is over and the alarm is due. */
    expired: phase === 'expired',
    /** Deadline passed, alarm not sent yet — the last chance to answer. */
    inGrace: phase === 'grace',
    /** When the alarm actually goes out. */
    alarmAt: expiresAt ? new Date(expiresAt.getTime() + TIMER_GRACE_MS) : null,
    start,
    extend,
    clear,
    claimExpiry,
  };
}
