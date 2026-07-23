-- Circle groups + multi-follower trips.
-- Groups let a user bundle circle members ("Family", "Roommates") so a whole
-- group can follow a trip in one tap. Trips gain multiple followers via a join
-- table; trips.buddy_id stays as the PRIMARY buddy (drives ETA-miss escalation
-- and the follow receipt), while trip_buddies fans out visibility + notifications.
-- Run in Supabase SQL Editor. Idempotent.

-- ── Groups ──────────────────────────────────────────────
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

ALTER TABLE circle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS groups_owner_all ON circle_groups;
CREATE POLICY groups_owner_all ON circle_groups
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Group membership is managed only by the group's owner.
DROP POLICY IF EXISTS group_members_owner_all ON circle_group_members;
CREATE POLICY group_members_owner_all ON circle_group_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM circle_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM circle_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

-- ── Trip followers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_buddies (
  trip_id  UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  buddy_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (trip_id, buddy_id)
);

ALTER TABLE trip_buddies ENABLE ROW LEVEL SECURITY;

-- The traveler (trip owner) manages who follows.
DROP POLICY IF EXISTS trip_buddies_owner_all ON trip_buddies;
CREATE POLICY trip_buddies_owner_all ON trip_buddies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
  );

-- A follower can see the rows that name them (so useFollowedTrips can find their trips).
DROP POLICY IF EXISTS trip_buddies_self_select ON trip_buddies;
CREATE POLICY trip_buddies_self_select ON trip_buddies
  FOR SELECT USING (auth.uid() = buddy_id);

-- Followers must be able to SELECT the trip rows they follow (mirrors the
-- existing buddy_id-based read, now via the join table).
DROP POLICY IF EXISTS trips_follower_select ON trips;
CREATE POLICY trips_follower_select ON trips
  FOR SELECT USING (
    auth.uid() = user_id
    OR auth.uid() = buddy_id
    OR EXISTS (SELECT 1 FROM trip_buddies tb WHERE tb.trip_id = trips.id AND tb.buddy_id = auth.uid())
  );
