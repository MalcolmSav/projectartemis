import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface DBEvent {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time: string | null;
  location: string | null;
  notes: string | null;
  check_in: boolean;
  created_at: string;
}

export function useEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<DBEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: true });
    setEvents((data ?? []) as DBEvent[]);
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
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `user_id=eq.${user.id}` }, refresh).subscribe();
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

  return { events, loading, refresh, addEvent, removeEvent };
}
