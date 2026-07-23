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
    // Trips I follow: legacy/primary via buddy_id, plus any where I'm a
    // follower in trip_buddies (multi-follower / group trips).
    const [{ data: primary }, { data: tb }] = await Promise.all([
      supabase.from('trips').select('*').eq('buddy_id', user.id).eq('status', 'active'),
      supabase.from('trip_buddies').select('trip_id').eq('buddy_id', user.id),
    ]);
    const followerTripIds = (tb ?? []).map((r: any) => r.trip_id);
    let followerTrips: Trip[] = [];
    if (followerTripIds.length > 0) {
      const { data: ft } = await supabase
        .from('trips')
        .select('*')
        .in('id', followerTripIds)
        .eq('status', 'active');
      followerTrips = (ft ?? []) as Trip[];
    }
    // Merge + dedupe by id.
    const byId: Record<string, Trip> = {};
    [...((primary ?? []) as Trip[]), ...followerTrips].forEach((t) => (byId[t.id] = t));
    const rows = Object.values(byId).sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );
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
    // No buddy_id filter — multi-follower trips arrive via trip_buddies, not
    // buddy_id. RLS limits delivered rows to trips we're actually allowed to
    // see, and refresh() re-derives the full followed set.
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_buddies' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  return { trips, loading, refresh };
}
