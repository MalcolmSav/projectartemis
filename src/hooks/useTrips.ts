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
  // Routing (nullable for legacy trips without a geocoded destination)
  dest_lat: number | null;
  dest_lng: number | null;
  route: [number, number][] | null; // [lng, lat] pairs
  distance_m: number | null;
  duration_s: number | null;
  remaining_m: number | null; // live, updated by the traveler
  remaining_s: number | null; // live, updated by the traveler
  followed_at: string | null; // set when the buddy opens the follow screen
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
    async (t: {
      destination: string;
      eta?: string;
      /** All followers. The first is the primary buddy (ETA-miss escalation,
       *  follow receipt); every id — including the first — becomes a follower. */
      buddyIds?: string[];
      transport?: string;
      locationInterval?: number;
      destLat?: number;
      destLng?: number;
      route?: [number, number][];
      distanceM?: number;
      durationS?: number;
    }) => {
      if (!user) return { error: 'Not signed in' };
      const buddyIds = (t.buddyIds ?? []).filter(Boolean);
      const primary = buddyIds[0] ?? null;
      const { data, error } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: t.destination,
          eta: t.eta ?? null,
          buddy_id: primary,
          transport: t.transport ?? null,
          location_interval: t.locationInterval ?? 60,
          dest_lat: t.destLat ?? null,
          dest_lng: t.destLng ?? null,
          route: t.route ?? null,
          distance_m: t.distanceM ?? null,
          duration_s: t.durationS ?? null,
          remaining_m: t.distanceM ?? null,
          remaining_s: t.durationS ?? null,
        })
        .select()
        .single();
      if (error) return { error: error.message };
      // Extra followers go in trip_buddies (the primary is already buddy_id).
      // Each row-insert drives its own "trip started" push, avoiding the race
      // where the trips-INSERT webhook fires before followers are written.
      const extras = buddyIds.slice(1);
      if (extras.length > 0) {
        await supabase
          .from('trip_buddies')
          .insert(extras.map((b) => ({ trip_id: (data as Trip).id, buddy_id: b })));
      }
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
