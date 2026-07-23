import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { shareCurrentPosition } from '../lib/sharePosition';
import { useAuth } from '../state/Auth';

export type CheckInKind = 'ok' | 'wellness_request' | 'wellness_response' | 'alarm';

export interface CheckIn {
  id: string;
  user_id: string;
  kind: CheckInKind;
  target_id: string | null;
  note: string | null;
  created_at: string;
  seen_at: string | null;
}

export interface PendingRequest extends CheckIn {
  from: Profile | null;
}

export const WELLNESS_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

export interface FriendAlarm {
  profile: Profile | null;
  checkIn: CheckIn;
}

export interface FriendNeedHelp {
  profile: Profile | null;
  checkIn: CheckIn;
}

export type SentCheckStatus = 'pending' | 'ok' | 'need_help' | 'alarm';

/** A wellness check someone sent TO me — persisted so it's visible in-app,
 *  not only as a push notification that can be missed. */
export interface ReceivedCheck {
  id: string;
  from: Profile | null;
  fromId: string;
  createdAt: string;
  status: 'pending' | 'answered' | 'expired';
}

export interface SentCheck {
  id: string; // the wellness_request id
  to: Profile | null;
  createdAt: string;
  status: SentCheckStatus;
  respondedAt: string | null;
  seenAt: string | null;
}

export function useCheckIns() {
  const { user } = useAuth();
  const [latestByUser, setLatestByUser] = useState<Record<string, CheckIn>>({});
  const [myLastOkAt, setMyLastOkAt] = useState<string | null>(null);
  const [pendingForMe, setPendingForMe] = useState<PendingRequest | null>(null);
  const [receivedChecks, setReceivedChecks] = useState<ReceivedCheck[]>([]);
  const [friendAlarm, setFriendAlarm] = useState<FriendAlarm | null>(null);
  const [friendNeedHelp, setFriendNeedHelp] = useState<FriendNeedHelp | null>(null);
  const [sentChecks, setSentChecks] = useState<SentCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const shownAlarmIds = useRef<Set<string>>(new Set());
  const shownNeedHelpIds = useRef<Set<string>>(new Set());

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

    // My most recent *actual* check-in (kind 'ok') — used for the "your last
    // check-in" label so that sending a wellness check doesn't masquerade as one.
    const myOk = (all ?? []).find((c: CheckIn) => c.user_id === user.id && c.kind === 'ok');
    setMyLastOkAt(myOk ? myOk.created_at : null);

    // Wellness checks directed at me (last 24 h). Powers BOTH the active
    // "respond now" hero (pendingForMe) and the persistent received-checks
    // list, so a check missed as a push is still visible in the app.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: requests }, { data: myResp }] = await Promise.all([
      supabase
        .from('check_ins')
        .select('*, from:profiles!check_ins_user_id_fkey(*)')
        .eq('kind', 'wellness_request')
        .eq('target_id', user.id)
        .gte('created_at', dayAgo)
        .order('created_at', { ascending: false })
        .limit(10),
      // My own responses in the same window — ONE query instead of one per request.
      supabase
        .from('check_ins')
        .select('id, kind, target_id, created_at')
        .eq('user_id', user.id)
        .in('kind', ['wellness_response', 'ok', 'alarm'])
        .gte('created_at', dayAgo)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    let chosen: PendingRequest | null = null;
    const received: ReceivedCheck[] = [];
    for (const req of (requests ?? []) as any[]) {
      const reqTime = new Date(req.created_at).getTime();
      // Answered if I raised an alarm (circle-wide) or replied to THIS requester.
      const answered = ((myResp ?? []) as any[]).some(
        (r) =>
          new Date(r.created_at).getTime() >= reqTime &&
          (r.kind === 'alarm' || r.target_id === req.user_id),
      );
      const withinWindow = Date.now() - reqTime <= WELLNESS_TIMEOUT_MS;
      received.push({
        id: req.id,
        from: (req.from as Profile) ?? null,
        fromId: req.user_id,
        createdAt: req.created_at,
        status: answered ? 'answered' : withinWindow ? 'pending' : 'expired',
      });
      // Most recent unanswered check still within its window → respond-now hero.
      if (!chosen && !answered && withinWindow) chosen = req as PendingRequest;
    }
    setReceivedChecks(received);
    setPendingForMe(chosen);

    // My recent wellness checks → who I checked and how each was answered.
    // Powers the sender-side history/feedback AND the urgent interrupts.
    const { data: mySentRaw } = await supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', user.id)
      .eq('kind', 'wellness_request')
      .order('created_at', { ascending: false })
      .limit(10);
    const mySent = (mySentRaw ?? []) as CheckIn[];
    const targetIds = Array.from(new Set(mySent.map((r) => r.target_id).filter(Boolean))) as string[];

    const targetProfiles: Record<string, Profile> = {};
    let theirResponses: CheckIn[] = [];
    if (targetIds.length > 0) {
      const [{ data: profs }, { data: resps }] = await Promise.all([
        supabase.from('profiles').select('*').in('id', targetIds),
        supabase
          .from('check_ins')
          .select('*')
          .in('user_id', targetIds)
          .in('kind', ['ok', 'wellness_response', 'alarm'])
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      (profs ?? []).forEach((p: Profile) => (targetProfiles[p.id] = p));
      theirResponses = (resps ?? []) as CheckIn[];
    }

    const sent: SentCheck[] = [];
    for (const req of mySent) {
      if (!req.target_id) continue;
      const reqTime = new Date(req.created_at).getTime();
      const after = theirResponses.filter(
        (c) =>
          c.user_id === req.target_id &&
          new Date(c.created_at).getTime() >= reqTime &&
          // Precise: a reply aimed at me, or a circle-wide alarm.
          (c.kind === 'alarm' || c.target_id === user.id),
      );
      // Most-relevant outcome wins: alarm > need_help > ok.
      const alarmResp = after.find((c) => c.kind === 'alarm');
      const needHelpResp = after.find((c) => c.kind === 'wellness_response' && c.note === 'need_help');
      const okResp = after.find((c) => c.kind === 'ok' || c.kind === 'wellness_response');
      let status: SentCheckStatus = 'pending';
      let answer: CheckIn | null = null;
      if (alarmResp) { status = 'alarm'; answer = alarmResp; }
      else if (needHelpResp) { status = 'need_help'; answer = needHelpResp; }
      else if (okResp) { status = 'ok'; answer = okResp; }
      sent.push({
        id: req.id,
        to: targetProfiles[req.target_id] ?? null,
        createdAt: req.created_at,
        status,
        respondedAt: answer?.created_at ?? null,
        seenAt: req.seen_at ?? null,
      });

      // Urgent interrupts (alarm / need-help) within the active window, once each.
      const withinWindow = Date.now() - reqTime <= WELLNESS_TIMEOUT_MS;
      if (withinWindow && alarmResp && !shownAlarmIds.current.has(alarmResp.id)) {
        shownAlarmIds.current.add(alarmResp.id);
        setFriendAlarm({ profile: targetProfiles[req.target_id] ?? null, checkIn: alarmResp });
      } else if (withinWindow && needHelpResp && !shownNeedHelpIds.current.has(needHelpResp.id)) {
        shownNeedHelpIds.current.add(needHelpResp.id);
        setFriendNeedHelp({ profile: targetProfiles[req.target_id] ?? null, checkIn: needHelpResp });
      }
    }
    setSentChecks(sent);

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
    // '*' so seen-receipt UPDATEs (seen_at) arrive live, not just new inserts.
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins' }, refresh).subscribe();
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
      // Pin the check-in to a place on the circle's map (fire-and-forget).
      shareCurrentPosition();
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

  /** Ask a friend if they're OK. One check per friend per 10 min (anti-spam). */
  const sendWellnessRequest = useCallback(
    async (friendId: string, note?: string): Promise<{ error?: string; cooldownMins?: number }> => {
      if (!user) return { error: 'Not signed in' };
      const COOLDOWN_MS = 10 * 60 * 1000;
      const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const { data: recent } = await supabase
        .from('check_ins')
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('target_id', friendId)
        .eq('kind', 'wellness_request')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      if (recent && recent.length > 0) {
        const elapsed = Date.now() - new Date((recent[0] as any).created_at).getTime();
        const cooldownMins = Math.max(1, Math.ceil((COOLDOWN_MS - elapsed) / 60_000));
        return {
          error: 'You already checked on them in the last few minutes — give them a moment to respond.',
          cooldownMins,
        };
      }
      const { error } = await supabase.from('check_ins').insert({
        user_id: user.id,
        target_id: friendId,
        kind: 'wellness_request' as CheckInKind,
        note: note ?? null,
      });
      if (!error) await refresh();
      return error ? { error: error.message } : {};
    },
    [user, refresh],
  );

  /**
   * Respond to a wellness check from `requesterId`. The reply is *targeted* at
   * that requester (target_id) so the sender can see exactly who answered and
   * the pending check clears only for them. An alarm stays broadcast (no target)
   * because it's a circle-wide emergency, not a private reply.
   */
  const respondWellness = useCallback(
    async (kind: 'ok' | 'wellness_response' | 'alarm', note?: string, requesterId?: string | null) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase.from('check_ins').insert({
        user_id: user.id,
        kind: kind as CheckInKind,
        note: note ?? null,
        target_id: kind === 'alarm' ? null : requesterId ?? null,
      });
      // Show the sender WHERE the response came from (map pin / "Active now").
      // Fire-and-forget so the response UI never waits on GPS.
      shareCurrentPosition();
      if (!error) await refresh();
      return error ? { error: error.message } : {};
    },
    [user, refresh],
  );

  const clearFriendAlarm = useCallback(() => setFriendAlarm(null), []);
  const clearFriendNeedHelp = useCallback(() => setFriendNeedHelp(null), []);

  return {
    latestByUser,
    myLastOkAt,
    pendingForMe,
    receivedChecks,
    sentChecks,
    friendAlarm,
    clearFriendAlarm,
    friendNeedHelp,
    clearFriendNeedHelp,
    loading,
    refresh,
    recordOk,
    recordAlarm,
    sendWellnessRequest,
    respondWellness,
  };
}
