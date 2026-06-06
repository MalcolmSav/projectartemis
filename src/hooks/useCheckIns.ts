import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export type CheckInKind = 'ok' | 'wellness_request' | 'wellness_response' | 'alarm';

export interface CheckIn {
  id: string;
  user_id: string;
  kind: CheckInKind;
  target_id: string | null;
  note: string | null;
  created_at: string;
}

export interface PendingRequest extends CheckIn {
  from: Profile | null;
}

const WELLNESS_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

export interface FriendAlarm {
  profile: Profile | null;
  checkIn: CheckIn;
}

export function useCheckIns() {
  const { user } = useAuth();
  const [latestByUser, setLatestByUser] = useState<Record<string, CheckIn>>({});
  const [pendingForMe, setPendingForMe] = useState<PendingRequest | null>(null);
  const [friendAlarm, setFriendAlarm] = useState<FriendAlarm | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which alarm IDs we've already surfaced so we don't re-alert on every refresh
  const shownAlarmIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) return;

    // Latest check-in per user (any kind, used for status dots)
    const { data: all } = await supabase
      .from('check_ins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    const map: Record<string, CheckIn> = {};
    (all ?? []).forEach((c: CheckIn) => {
      if (!map[c.user_id]) map[c.user_id] = c;
    });
    setLatestByUser(map);

    // Find a pending wellness_request directed at me, not yet responded to
    const { data: requests } = await supabase
      .from('check_ins')
      .select('*, from:profiles!check_ins_user_id_fkey(*)')
      .eq('kind', 'wellness_request')
      .eq('target_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    let chosen: PendingRequest | null = null;
    if (requests && requests.length > 0) {
      // Most recent that's still within window AND I haven't responded after
      for (const req of requests as any[]) {
        const reqTime = new Date(req.created_at).getTime();
        if (Date.now() - reqTime > WELLNESS_TIMEOUT_MS) continue;
        const { data: resp } = await supabase
          .from('check_ins')
          .select('id, created_at')
          .eq('user_id', user.id)
          .in('kind', ['wellness_response', 'ok', 'alarm'])
          .gte('created_at', req.created_at)
          .limit(1);
        if (!resp || resp.length === 0) {
          chosen = req as PendingRequest;
          break;
        }
      }
    }
    setPendingForMe(chosen);

    // Detect if a friend I sent a wellness request to has responded with an alarm
    const { data: mySent } = await supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'wellness_request')
      .gte('created_at', new Date(Date.now() - WELLNESS_TIMEOUT_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (mySent && mySent.length > 0) {
      for (const req of mySent as CheckIn[]) {
        if (!req.target_id) continue;
        const { data: alarms } = await supabase
          .from('check_ins')
          .select('*, profile:profiles!check_ins_user_id_fkey(*)')
          .eq('user_id', req.target_id)
          .eq('kind', 'alarm')
          .gte('created_at', req.created_at)
          .order('created_at', { ascending: false })
          .limit(1);
        if (alarms && alarms.length > 0) {
          const alarm = alarms[0] as any;
          if (!shownAlarmIds.current.has(alarm.id)) {
            shownAlarmIds.current.add(alarm.id);
            setFriendAlarm({ profile: alarm.profile ?? null, checkIn: alarm as CheckIn });
          }
          break;
        }
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `checkins:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_ins' }, refresh).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const recordOk = useCallback(
    async (note?: string) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase
        .from('check_ins')
        .insert({ user_id: user.id, kind: 'ok' as CheckInKind, note: note ?? null });
      return error ? { error: error.message } : {};
    },
    [user],
  );

  const recordAlarm = useCallback(
    async (note?: string) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase
        .from('check_ins')
        .insert({ user_id: user.id, kind: 'alarm' as CheckInKind, note: note ?? null });
      return error ? { error: error.message } : {};
    },
    [user],
  );

  /** Ask a friend if they're OK. */
  const sendWellnessRequest = useCallback(
    async (friendId: string, note?: string) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase.from('check_ins').insert({
        user_id: user.id,
        target_id: friendId,
        kind: 'wellness_request' as CheckInKind,
        note: note ?? null,
      });
      return error ? { error: error.message } : {};
    },
    [user],
  );

  /** Respond to a wellness check directed at me. */
  const respondWellness = useCallback(
    async (kind: 'ok' | 'wellness_response' | 'alarm', note?: string) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase
        .from('check_ins')
        .insert({ user_id: user.id, kind: kind as CheckInKind, note: note ?? null });
      if (!error) await refresh();
      return error ? { error: error.message } : {};
    },
    [user, refresh],
  );

  const clearFriendAlarm = useCallback(() => setFriendAlarm(null), []);

  return {
    latestByUser,
    pendingForMe,
    friendAlarm,
    clearFriendAlarm,
    loading,
    refresh,
    recordOk,
    recordAlarm,
    sendWellnessRequest,
    respondWellness,
  };
}
