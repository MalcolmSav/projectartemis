-- ============================================================================
--  RUN THIS ONE FILE in the Supabase SQL Editor.
--
--  Verified against the live database on 2026-08-01. Already applied (skipped
--  here): notification_prefs, battery_and_seen, and the routing columns of
--  trip_routes (dest_lat/route/remaining_*).
--
--  Still missing — everything below. Note trip_routes.sql was run BEFORE
--  `followed_at` was appended to it, which is exactly why "is your buddy
--  following?" never works: the column doesn't exist, so the write silently
--  fails. Everything here is idempotent and safe to re-run.
-- ============================================================================

-- ── 1. Follow receipt + buddy write access ──────────────────────────────────
ALTER TABLE trips ADD COLUMN IF NOT EXISTS followed_at TIMESTAMPTZ;

-- Followers need UPDATE on trips they follow: to confirm they're watching, and
-- to close a trip the traveler forgot to end.
DROP POLICY IF EXISTS trips_buddy_update ON trips;
CREATE POLICY trips_buddy_update ON trips
  FOR UPDATE USING (auth.uid() = buddy_id) WITH CHECK (auth.uid() = buddy_id);

-- ── 2. Circle groups ("Family", "Roommates") ────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_group_members (
  group_id  UUID NOT NULL REFERENCES circle_groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, member_id)
);

ALTER TABLE circle_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS groups_owner_all ON circle_groups;
CREATE POLICY groups_owner_all ON circle_groups
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS group_members_owner_all ON circle_group_members;
CREATE POLICY group_members_owner_all ON circle_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM circle_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM circle_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- ── 3. Multiple trip followers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_buddies (
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  buddy_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,          -- set when they tap "I'm following"
  PRIMARY KEY (trip_id, buddy_id)
);
-- Safe if the table already existed without the column.
ALTER TABLE trip_buddies ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE trip_buddies ENABLE ROW LEVEL SECURITY;

-- The traveler manages who follows.
DROP POLICY IF EXISTS trip_buddies_owner_all ON trip_buddies;
CREATE POLICY trip_buddies_owner_all ON trip_buddies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  );

-- A follower can see their own row, and confirm it (accepted_at).
DROP POLICY IF EXISTS trip_buddies_self_select ON trip_buddies;
CREATE POLICY trip_buddies_self_select ON trip_buddies
  FOR SELECT USING (auth.uid() = buddy_id);

DROP POLICY IF EXISTS trip_buddies_self_update ON trip_buddies;
CREATE POLICY trip_buddies_self_update ON trip_buddies
  FOR UPDATE USING (auth.uid() = buddy_id) WITH CHECK (auth.uid() = buddy_id);

-- Followers must be able to read the trips they follow.
DROP POLICY IF EXISTS trips_follower_select ON trips;
CREATE POLICY trips_follower_select ON trips
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = buddy_id
    OR EXISTS (SELECT 1 FROM trip_buddies tb WHERE tb.trip_id = trips.id AND tb.buddy_id = auth.uid())
  );

-- ── 4. Trip chat ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  system     BOOLEAN NOT NULL DEFAULT false,  -- "X is now following" notices
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_messages_trip_idx ON trip_messages (trip_id, created_at);

ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;

-- Anyone on the trip (traveler, primary buddy, or a follower) can read it.
DROP POLICY IF EXISTS trip_messages_participants_select ON trip_messages;
CREATE POLICY trip_messages_participants_select ON trip_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id
        AND (
          t.user_id = auth.uid()
          OR t.buddy_id = auth.uid()
          OR EXISTS (SELECT 1 FROM trip_buddies tb WHERE tb.trip_id = t.id AND tb.buddy_id = auth.uid())
        )
    )
  );

-- ...and post to it as themselves.
DROP POLICY IF EXISTS trip_messages_participants_insert ON trip_messages;
CREATE POLICY trip_messages_participants_insert ON trip_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trips t
      WHERE t.id = trip_id
        AND (
          t.user_id = auth.uid()
          OR t.buddy_id = auth.uid()
          OR EXISTS (SELECT 1 FROM trip_buddies tb WHERE tb.trip_id = t.id AND tb.buddy_id = auth.uid())
        )
    )
  );

-- ── 5. Calendar sharing (viewers can read shared events) ────────────────────
ALTER TABLE calendar_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calshares_owner_all ON calendar_shares;
CREATE POLICY calshares_owner_all ON calendar_shares
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS calshares_viewer_select ON calendar_shares;
CREATE POLICY calshares_viewer_select ON calendar_shares
  FOR SELECT USING (auth.uid() = viewer_id);

-- 'full' → all events; 'checkin' → only check-in events; 'none' → nothing.
DROP POLICY IF EXISTS events_shared_select ON events;
CREATE POLICY events_shared_select ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM calendar_shares cs
      WHERE cs.owner_id = events.user_id
        AND cs.viewer_id = auth.uid()
        AND cs.level <> 'none'
        AND (cs.level = 'full' OR events.check_in)
    )
  );

-- ── 6. Realtime for the new tables (so chat/accepts stream live) ────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trip_buddies;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
