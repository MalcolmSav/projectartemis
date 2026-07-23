import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { useCircle } from './useCircle';

export interface IncomingAlarm {
  checkInId: string;
  userId: string;
  profile: Profile | null;
  createdAt: string;
}

/**
 * Live-listens for ANY circle member raising a general SOS alarm (not just
 * alarms sent in response to a wellness check I sent — see useCheckIns'
 * `friendAlarm`, which only covers that narrower case). This is what powers
 * the in-app "friend needs help" screen while the app is foregrounded; the
 * push-notification tap path (app backgrounded) is handled separately in
 * App.tsx using the same destination screen.
 */
export function useIncomingAlarms() {
  const { user } = useAuth();
  const { members } = useCircle();
  const [alarm, setAlarm] = useState<IncomingAlarm | null>(null);
  const shownIds = useRef<Set<string>>(new Set());
  const membersRef = useRef(members);
  membersRef.current = members;

  const handleInsert = useCallback(
    async (row: { id: string; user_id: string; kind: string; created_at: string }) => {
      if (row.kind !== 'alarm') return;
      if (!user || row.user_id === user.id) return; // never react to our own alarm
      if (shownIds.current.has(row.id)) return;
      const member = membersRef.current.find((m) => m.profile.id === row.user_id);
      if (!member) return; // only circle members, not arbitrary users
      shownIds.current.add(row.id);
      setAlarm({ checkInId: row.id, userId: row.user_id, profile: member.profile, createdAt: row.created_at });
    },
    [user],
  );

  useEffect(() => {
    if (!user) return;
    const topic = `incoming-alarms:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'check_ins' },
      (payload) => handleInsert(payload.new as any),
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, handleInsert]);

  const clear = useCallback(() => setAlarm(null), []);

  return { alarm, clear };
}
