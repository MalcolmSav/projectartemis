import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { Trip } from './useTrips';

export interface FollowedTrip extends Trip {
  traveler: Profile | null;
}

/** Active trips where the current user is the chosen buddy (someone to follow). */
export function useFollowedTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<FollowedTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('buddy_id', user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    const rows = (data ?? []) as Trip[];
    // Join traveler profiles in a second query (FK-name agnostic).
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    let profiles: Record<string, Profile> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
      (profs ?? []).forEach((p: Profile) => (profiles[p.id] = p));
    }
    setTrips(rows.map((r) => ({ ...r, traveler: profiles[r.user_id] ?? null })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const topic = `followed:${user.id}:${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(topic);
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trips', filter: `buddy_id=eq.${user.id}` },
      refresh,
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  return { trips, loading, refresh };
}
