import { useCallback, useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../state/Auth';
import { personName } from '../lib/person';
import { postTripSystemMessage } from './useTripChat';
import type { Trip } from './useTrips';

export interface TripFollower {
  id: string;
  profile: Profile | null;
  /** The buddy alerted if the traveler misses their ETA. */
  isPrimary: boolean;
  /** They explicitly confirmed they're watching. */
  accepted: boolean;
}

/**
 * Who is following a trip and whether they've actually confirmed it.
 *
 * Confirmation is explicit (a button) rather than inferred from opening the
 * screen — the traveler needs a definite "yes, I'm watching", not a guess.
 * The primary buddy's confirmation lives on trips.followed_at (it also drives
 * the existing push to the traveler); extra followers use
 * trip_buddies.accepted_at.
 */
export function useTripFollowers(trip: Trip | null) {
  const { user, profile } = useAuth();
  const [followers, setFollowers] = useState<TripFollower[]>([]);
  const [busy, setBusy] = useState(false);

  const tripId = trip?.id ?? null;

  const refresh = useCallback(async () => {
    if (!trip) { setFollowers([]); return; }
    // RLS: the traveler sees every row; a follower sees only their own.
    const { data: tb } = await supabase
      .from('trip_buddies')
      .select('buddy_id, accepted_at')
      .eq('trip_id', trip.id);
    const rows = (tb ?? []) as { buddy_id: string; accepted_at: string | null }[];

    const ids = new Set<string>(rows.map((r) => r.buddy_id));
    if (trip.buddy_id) ids.add(trip.buddy_id);
    const idList = Array.from(ids);
    if (idList.length === 0) { setFollowers([]); return; }

    const { data: profs } = await supabase.from('profiles').select('*').in('id', idList);
    const byId: Record<string, Profile> = {};
    (profs ?? []).forEach((p: Profile) => (byId[p.id] = p));

    setFollowers(
      idList.map((id) => {
        const isPrimary = trip.buddy_id === id;
        const row = rows.find((r) => r.buddy_id === id);
        return {
          id,
          profile: byId[id] ?? null,
          isPrimary,
          accepted: isPrimary ? !!trip.followed_at : !!row?.accepted_at,
        };
      }),
    );
  }, [tripId, trip?.buddy_id, trip?.followed_at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!tripId) return;
    const ch = supabase
      .channel(`tripfollowers:${tripId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_buddies', filter: `trip_id=eq.${tripId}` },
        refresh,
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId, refresh]);

  /** Am I already confirmed as following this trip? */
  const meConfirmed = !!user && followers.some((f) => f.id === user.id && f.accepted);
  const meIsFollower = !!user && followers.some((f) => f.id === user.id);

  /** Explicitly confirm "I'm following your trip". */
  const confirmFollowing = useCallback(async () => {
    if (!trip || !user) return { error: 'Not signed in' };
    setBusy(true);
    const now = new Date().toISOString();
    let errMsg: string | null = null;

    if (trip.buddy_id === user.id) {
      // Primary buddy — this also fires the traveler's "is following" push.
      const { error } = await supabase.from('trips').update({ followed_at: now }).eq('id', trip.id);
      if (error) errMsg = error.message;
    }
    // Extra-follower row (no-op if they're only the primary buddy).
    const { error: tbErr } = await supabase
      .from('trip_buddies')
      .update({ accepted_at: now })
      .eq('trip_id', trip.id)
      .eq('buddy_id', user.id);
    if (tbErr && !errMsg && trip.buddy_id !== user.id) errMsg = tbErr.message;

    if (!errMsg) {
      // Visible to the traveler and every other follower, without needing an
      // extra webhook for non-primary followers.
      await postTripSystemMessage(trip.id, user.id, `${personName(profile)} is now following this trip`);
    }
    setBusy(false);
    await refresh();
    return errMsg ? { error: errMsg } : {};
  }, [trip, user, profile, refresh]);

  const acceptedCount = followers.filter((f) => f.accepted).length;

  return { followers, acceptedCount, meConfirmed, meIsFollower, busy, confirmFollowing, refresh };
}
