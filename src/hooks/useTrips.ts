import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/Auth';

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  eta: string | null;
  buddy_id: string | null;
  transport: string | null;
  location_interval: number; // seconds between location updates
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'arrived' | 'cancelled' | 'escalated';
}

export function useTrips() {
  const { user } = useAuth();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1);
    setActiveTrip((data?.[0] as Trip) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `trips:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `user_id=eq.${user.id}` }, refresh).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const start = useCallback(
    async (t: { destination: string; eta?: string; buddyId?: string | null; transport?: string; locationInterval?: number }) => {
      if (!user) return { error: 'Not signed in' };
      const { data, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: t.destination,
          eta: t.eta ?? null,
          buddy_id: t.buddyId ?? null,
          transport: t.transport ?? null,
          location_interval: t.locationInterval ?? 60,
        })
        .select()
        .single();
      if (error) return { error: error.message };
      setActiveTrip(data as Trip);
      return { trip: data as Trip };
    },
    [user],
  );

  const finish = useCallback(
    async (status: 'arrived' | 'cancelled' | 'escalated') => {
      if (!activeTrip) return {};
      const { error } = await supabase
        .from('trips')
        .update({ status, ended_at: new Date().toISOString() })
        .eq('id', activeTrip.id);
      if (error) return { error: error.message };
      setActiveTrip(null);
      return {};
    },
    [activeTrip],
  );

  return { activeTrip, loading, refresh, start, finish };
}
