import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface TripMessage {
  id: string;
  trip_id: string;
  sender_id: string | null;
  body: string;
  system: boolean;
  created_at: string;
}

/**
 * Group chat scoped to one trip — the traveler and everyone following can talk
 * in one place, instead of the traveler DMing each follower separately.
 * Also carries system notices ("Emma is now following your trip").
 */
export function useTripChat(tripId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [people, setPeople] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    if (!tripId) { setMessages([]); setLoading(false); return; }
    const { data } = await supabase
      .from('trip_messages')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true })
      .limit(200);
    const rows = (data ?? []) as TripMessage[];
    setMessages(rows);
    setLoading(false);

    // Resolve sender names for anyone we haven't seen yet.
    const missing = Array.from(
      new Set(rows.map((m) => m.sender_id).filter((id): id is string => !!id)),
    ).filter((id) => !people[id]);
    if (missing.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', missing);
      if (profs) {
        setPeople((prev) => {
          const next = { ...prev };
          (profs as Profile[]).forEach((p) => (next[p.id] = p));
          return next;
        });
      }
    }
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLoading(true); refresh(); }, [refresh]);

  useEffect(() => {
    if (!tripId) return;
    const ch = supabase
      .channel(`tripchat:${tripId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId, refresh]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || !tripId || !user) return { error: 'Not signed in' };
      setSending(true);
      const { error } = await supabase
        .from('trip_messages')
        .insert({ trip_id: tripId, sender_id: user.id, body: text });
      setSending(false);
      if (!error) await refresh();
      return error ? { error: error.message } : {};
    },
    [tripId, user, refresh],
  );

  return { messages, people, loading, sending, send, refresh };
}

/** Post a system notice into a trip's chat (best-effort). */
export async function postTripSystemMessage(tripId: string, senderId: string, body: string) {
  try {
    await supabase.from('trip_messages').insert({ trip_id: tripId, sender_id: senderId, body, system: true });
  } catch {
    // non-critical
  }
}
