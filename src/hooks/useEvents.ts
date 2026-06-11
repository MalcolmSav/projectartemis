import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface DBEvent {
  id: string;
  user_id: string;
  date: string;
  title: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  check_in: boolean;
  created_at: string;
}

export interface FriendEvent extends DBEvent {
  owner: Profile | null;
}

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<DBEvent[]>([]);
  const [friendEvents, setFriendEvents] = useState<FriendEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    // My events
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
    setEvents((data ?? []) as DBEvent[]);

    // Friends' visible events — RLS already filters by calendar_shares level
    const { data: fe } = await supabase
      .from('events')
      .select('*, owner:profiles!events_user_id_fkey(*)')
      .neq('user_id', user.id)
      .order('date', { ascending: true });
    setFriendEvents((fe ?? []) as FriendEvent[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `events:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    // Re-fetch when any event changes OR when a calendar share is granted/revoked
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_shares' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const addEvent = useCallback(
    async (e: { date: string; title: string; time?: string; location?: string; notes?: string; checkIn?: boolean }) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase.from('events').insert({
        user_id: user.id,
        date: e.date,
        title: e.title,
        time: e.time ?? null,
        location: e.location ?? null,
        notes: e.notes ?? null,
        check_in: !!e.checkIn,
      });
      return error ? { error: error.message } : {};
    },
    [user],
  );

  const removeEvent = useCallback(async (id: string) => {
    const { error } = await supabase.from('events').delete().eq('id', id);
    return error ? { error: error.message } : {};
  }, []);

  return { events, friendEvents, loading, refresh, addEvent, removeEvent };
}
