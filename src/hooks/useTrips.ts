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
  /** Terminal states only. Escalation is `escalated_at`, not a status — see below. */
  status: 'active' | 'arrived' | 'cancelled' | 'escalated';
  /** The ETA as a real instant, so the server-side watchdog can enforce it. */
  eta_at: string | null;
  /**
   * Set when the trip is escalated — by the traveller tapping "Need help", or by
   * the watchdog when the ETA passes unanswered. The trip deliberately stays
   * `active`: an escalated traveller is exactly who you most need to keep
   * tracking, and ending the trip would stop the background location broadcast
   * that the follower's alert tells them to go and look at.
   */
  escalated_at: string | null;
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

/**
 * Turn an "HH:MM" ETA into a real instant, relative to `from`. A time that has
 * already passed today means tomorrow — someone leaving at 23:50 with an ETA of
 * 00:20 is not half a day late.
 */
export function etaToTimestamp(eta: string, from: Date = new Date()): Date | null {
  const [h, m] = eta.split(':').map((n) => parseInt(n, 10));
  if (isNaN(h) || isNaN(m)) return null;
  const at = new Date(from);
  at.setHours(h, m, 0, 0);
  if (at.getTime() <= from.getTime()) at.setDate(at.getDate() + 1);
  return at;
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
          // Resolved here so the watchdog can compare a timestamp instead of
          // re-deriving one from an "HH:MM" string and started_at.
          eta_at: t.eta ? etaToTimestamp(t.eta)?.toISOString() ?? null : null,
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

  /**
   * Raise the alarm on a trip WITHOUT ending it. The trip stays `active`, so
   * useTripBroadcast keeps the background location task running and the
   * follower's map keeps moving — which is the whole point of escalating.
   * Ending the trip is still the traveller's call ("I've arrived" / cancel).
   */
  const escalate = useCallback(async () => {
    if (!activeTrip || activeTrip.escalated_at) return {};
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('trips')
      .update({ escalated_at: now })
      .eq('id', activeTrip.id);
    if (error) return { error: error.message };
    setActiveTrip({ ...activeTrip, escalated_at: now });
    return {};
  }, [activeTrip]);

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

  return { activeTrip, loading, refresh, start, finish, escalate };
}
