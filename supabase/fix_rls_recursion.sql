-- ============================================================================
--  FIX: "infinite recursion detected in policy for relation \"trips\""
--
--  Cause: trips' follower policy read trip_buddies, and trip_buddies' owner
--  policy read trips. Each subquery re-entered the other table's policies, so
--  Postgres aborted the cycle. It only bit trips with 2+ followers, because a
--  single-buddy trip never writes a trip_buddies row.
--
--  Fix: the cross-table lookups move into SECURITY DEFINER helpers, which read
--  past RLS and so end the chain (same pattern as public.is_circle_member).
--  Neither helper leaks anything: both answer only about auth.uid().
--
--  Run in the Supabase SQL Editor. Idempotent.
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Do I own trip `t`? Used by trip_buddies' policies instead of reading trips.
CREATE OR REPLACE FUNCTION public.owns_trip(t UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips WHERE id = t AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.owns_trip(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.owns_trip(UUID) TO authenticated;

-- Am I a follower of trip `t`? Used by trips' policy instead of reading
-- trip_buddies. Covers extra followers only; the primary buddy is trips.buddy_id.
CREATE OR REPLACE FUNCTION public.follows_trip(t UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_buddies WHERE trip_id = t AND buddy_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.follows_trip(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.follows_trip(UUID) TO authenticated;

-- ── Rewritten policies ──────────────────────────────────────────────────────

-- The traveler manages who follows.
DROP POLICY IF EXISTS trip_buddies_owner_all ON trip_buddies;
CREATE POLICY trip_buddies_owner_all ON trip_buddies
  FOR ALL USING (public.owns_trip(trip_id))
  WITH CHECK (public.owns_trip(trip_id));

-- Followers must be able to read the trips they follow.
DROP POLICY IF EXISTS trips_follower_select ON trips;
CREATE POLICY trips_follower_select ON trips
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = buddy_id
    OR public.follows_trip(id)
  );

-- Trip chat: same participant test, without the nested trip_buddies read.
DROP POLICY IF EXISTS trip_messages_participants_select ON trip_messages;
CREATE POLICY trip_messages_participants_select ON trip_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id
        AND (t.user_id = auth.uid() OR t.buddy_id = auth.uid() OR public.follows_trip(t.id))
    )
  );

DROP POLICY IF EXISTS trip_messages_participants_insert ON trip_messages;
CREATE POLICY trip_messages_participants_insert ON trip_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id
        AND (t.user_id = auth.uid() OR t.buddy_id = auth.uid() OR public.follows_trip(t.id))
    )
  );
