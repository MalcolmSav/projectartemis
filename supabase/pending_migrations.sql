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
-- NOTE: trips and trip_buddies must NOT read each other from their policies —
-- that mutual reference is an RLS cycle ("infinite recursion detected in policy
-- for relation trips") and breaks any trip with 2+ followers. The cross-table
-- lookups go through the SECURITY DEFINER helpers below, which read past RLS.
CREATE TABLE IF NOT EXISTS trip_buddies (
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  buddy_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,          -- set when they tap "I'm following"
  PRIMARY KEY (trip_id, buddy_id)
);
-- Safe if the table already existed without the column.
ALTER TABLE trip_buddies ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE trip_buddies ENABLE ROW LEVEL SECURITY;

-- Do I own trip `t`? / Am I a follower of trip `t`? SECURITY DEFINER so the
-- policies below can answer without re-entering the other table's RLS.
-- Neither leaks anything: both answer only about auth.uid().
CREATE OR REPLACE FUNCTION public.owns_trip(t UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trips WHERE id = t AND user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.owns_trip(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.owns_trip(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.follows_trip(t UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.trip_buddies WHERE trip_id = t AND buddy_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.follows_trip(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.follows_trip(UUID) TO authenticated;

-- The traveler manages who follows.
DROP POLICY IF EXISTS trip_buddies_owner_all ON trip_buddies;
CREATE POLICY trip_buddies_owner_all ON trip_buddies
  FOR ALL USING (public.owns_trip(trip_id))
  WITH CHECK (public.owns_trip(trip_id));

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
    OR public.follows_trip(id)
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
          OR public.follows_trip(t.id)
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
          OR public.follows_trip(t.id)
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

-- ── 7. Event end times ──────────────────────────────────────────────────────
-- A check-in flagged event promises a prompt "at the end of the event", but an
-- event only had a start, so the app asked "are you home safe?" the minute you
-- arrived. "HH:MM", same shape as `time`; an end earlier than the start means
-- the event runs past midnight.
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TEXT;

-- ── 8. "Check on me" — who to alert ─────────────────────────────────────────
-- The timer alerted the entire circle, always. Users setting one before a date
-- or a late shift want a specific person told, not everybody. NULL or empty
-- keeps the old behaviour (whole circle), so existing rows need no backfill.
ALTER TABLE safety_timers ADD COLUMN IF NOT EXISTS alert_ids UUID[];

-- The chosen recipients ride along on the alarm the timer raises, since that is
-- the row the notify webhook actually fans out from. Every other alarm (the red
-- button, a wellness response) leaves it NULL and still reaches the whole circle.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS alert_ids UUID[];

-- NOTE: the watchdog now fires a timer at expires_at + 5 min (the grace window
-- the app shows as "last chance"), so redeploy it alongside this migration:
--   npx supabase functions deploy watchdog --project-ref pbqcsgthnwaqpddsucrx
--   npx supabase functions deploy notify   --project-ref pbqcsgthnwaqpddsucrx

-- ── 9. Child accounts (parental control) ────────────────────────────────────
--
--  A child account is one that has at least one guardian. The rule the whole
--  section exists to enforce: A CHILD'S CIRCLE CONTAINS THEIR GUARDIANS AND
--  NOBODY ELSE. Hiding the "add" button is not enough — anyone can call the
--  REST API directly — so the invariant lives in triggers on `circles` and
--  `invites`, which fire no matter which RPC or client did the write.
--
--  Deliberately NOT restricted: alarms, wellness responses, emergency calling,
--  and delete_my_account. A parental control that can stop a child raising an
--  alarm is a safety hazard, not a feature.

CREATE TABLE IF NOT EXISTS guardians (
  child_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, guardian_id),
  CONSTRAINT guardians_not_self CHECK (child_id <> guardian_id)
);
CREATE INDEX IF NOT EXISTS guardians_guardian_idx ON guardians (guardian_id);

CREATE TABLE IF NOT EXISTS guardian_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guardian_requests_child_idx
  ON guardian_requests (child_id) WHERE status = 'pending';

-- ── Helpers (SECURITY DEFINER so triggers and policies can read past RLS) ───
CREATE OR REPLACE FUNCTION public.is_child(u UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.guardians WHERE child_id = u);
$$;
REVOKE ALL ON FUNCTION public.is_child(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_child(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_guardian_of(g UUID, c UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.guardians WHERE guardian_id = g AND child_id = c);
$$;
REVOKE ALL ON FUNCTION public.is_guardian_of(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(UUID, UUID) TO authenticated;

-- ── RLS: both sides of a link can see it; all writes go through the RPCs ────
ALTER TABLE guardians         ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guardians_visible ON guardians;
CREATE POLICY guardians_visible ON guardians
  FOR SELECT USING (auth.uid() = child_id OR auth.uid() = guardian_id);

DROP POLICY IF EXISTS guardian_requests_visible ON guardian_requests;
CREATE POLICY guardian_requests_visible ON guardian_requests
  FOR SELECT USING (
    auth.uid() = child_id
    OR auth.uid() = guardian_id
    -- An existing guardian vets requests from anyone else wanting in.
    OR public.is_guardian_of(auth.uid(), child_id)
  );

-- ── The lock ────────────────────────────────────────────────────────────────
-- A child may not be on either side of a circle edge with anyone but a guardian.
CREATE OR REPLACE FUNCTION public.enforce_child_circle()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_child(NEW.owner_id) AND NOT public.is_guardian_of(NEW.member_id, NEW.owner_id) THEN
    RAISE EXCEPTION 'This is a child account — only a guardian can be in its circle'
      USING ERRCODE = 'check_violation';
  END IF;
  IF public.is_child(NEW.member_id) AND NOT public.is_guardian_of(NEW.owner_id, NEW.member_id) THEN
    RAISE EXCEPTION 'That is a child account — only a guardian can be in its circle'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circles_child_lock ON circles;
CREATE TRIGGER circles_child_lock
  BEFORE INSERT OR UPDATE ON circles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_circle();

-- A child cannot drop their guardian. The guardian can (end_guardianship), and
-- so can any caller that has set the bypass — which is only ever done inside the
-- functions below and in delete_my_account, so a child can still delete their
-- account and take the whole link with it.
CREATE OR REPLACE FUNCTION public.enforce_child_circle_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('artemis.child_lock_bypass', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  IF auth.uid() IS NULL THEN            -- service role / scheduled jobs
    RETURN OLD;
  END IF;
  IF (public.is_child(OLD.owner_id) AND auth.uid() = OLD.owner_id)
     OR (public.is_child(OLD.member_id) AND auth.uid() = OLD.member_id) THEN
    RAISE EXCEPTION 'This is a child account — only a guardian can change its circle'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS circles_child_lock_delete ON circles;
CREATE TRIGGER circles_child_lock_delete
  BEFORE DELETE ON circles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_circle_delete();

-- Invites are the other way into a circle, so they're closed off too — in both
-- directions, or a stranger could invite a child and the child's acceptance
-- would be blocked at `circles` with a confusing error instead of never offered.
CREATE OR REPLACE FUNCTION public.enforce_child_invites()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_child(NEW.from_user) THEN
    RAISE EXCEPTION 'Child accounts cannot invite people to their circle'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.email) = lower(NEW.to_email) AND public.is_child(p.id)
  ) THEN
    RAISE EXCEPTION 'That is a child account — ask their guardian instead'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invites_child_lock ON invites;
CREATE TRIGGER invites_child_lock
  BEFORE INSERT ON invites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_child_invites();

-- ── RPCs ────────────────────────────────────────────────────────────────────

-- Ask to become a guardian of `child`.
CREATE OR REPLACE FUNCTION public.request_guardianship(child UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me  UUID := auth.uid();
  req UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF me = child THEN RAISE EXCEPTION 'You cannot guard your own account'; END IF;
  IF public.is_child(me) THEN
    RAISE EXCEPTION 'A managed account cannot become a guardian';
  END IF;
  IF public.is_guardian_of(me, child) THEN
    RAISE EXCEPTION 'You already manage that account';
  END IF;
  IF EXISTS (
    SELECT 1 FROM guardian_requests
    WHERE guardian_id = me AND child_id = child AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already asked — it is waiting to be approved';
  END IF;

  INSERT INTO guardian_requests (guardian_id, child_id)
  VALUES (me, child)
  RETURNING id INTO req;
  RETURN req;
END;
$$;
REVOKE ALL ON FUNCTION public.request_guardianship(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.request_guardianship(UUID) TO authenticated;

-- Answer a guardianship request.
--
-- WHO may answer is the whole security story. The first link is the child's own
-- decision. After that an EXISTING GUARDIAN decides — otherwise a child could
-- hand "guardian" (and therefore a place in their locked circle) to anyone who
-- asked, which is exactly the hole the lock is meant to close.
CREATE OR REPLACE FUNCTION public.respond_guardianship(request_id UUID, accept BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me  UUID := auth.uid();
  rq  guardian_requests%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO rq FROM guardian_requests WHERE id = request_id AND status = 'pending';
  IF rq.id IS NULL THEN RAISE EXCEPTION 'That request is no longer open'; END IF;

  IF public.is_child(rq.child_id) THEN
    IF NOT public.is_guardian_of(me, rq.child_id) THEN
      RAISE EXCEPTION 'Only an existing guardian can approve this';
    END IF;
  ELSIF me <> rq.child_id THEN
    RAISE EXCEPTION 'Only that account can accept a guardian';
  END IF;

  IF NOT accept THEN
    UPDATE guardian_requests SET status = 'declined' WHERE id = rq.id;
    RETURN;
  END IF;

  PERFORM set_config('artemis.child_lock_bypass', 'on', true);

  -- Becoming a managed account clears whoever was already there: "only your
  -- guardians are in your circle" has to be true from the first moment, not
  -- just for people added afterwards.
  IF NOT public.is_child(rq.child_id) THEN
    DELETE FROM circles WHERE owner_id = rq.child_id OR member_id = rq.child_id;
    DELETE FROM invites
     WHERE status = 'pending'
       AND (from_user = rq.child_id
            OR lower(to_email) = (SELECT lower(email) FROM profiles WHERE id = rq.child_id));
  END IF;

  INSERT INTO guardians (child_id, guardian_id)
  VALUES (rq.child_id, rq.guardian_id)
  ON CONFLICT DO NOTHING;

  -- Both directions, so each sees the other's check-ins.
  INSERT INTO circles (owner_id, member_id, relation, verified)
  VALUES (rq.child_id, rq.guardian_id, 'Guardian', true)
  ON CONFLICT DO NOTHING;
  INSERT INTO circles (owner_id, member_id, relation, verified)
  VALUES (rq.guardian_id, rq.child_id, 'Child', true)
  ON CONFLICT DO NOTHING;

  UPDATE guardian_requests SET status = 'accepted' WHERE id = rq.id;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_guardianship(UUID, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.respond_guardianship(UUID, BOOLEAN) TO authenticated;

-- Release an account. Guardian-only, on purpose: a managed account that can
-- unmanage itself is not managed.
CREATE OR REPLACE FUNCTION public.end_guardianship(child UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_guardian_of(me, child) THEN
    RAISE EXCEPTION 'You do not manage that account';
  END IF;

  PERFORM set_config('artemis.child_lock_bypass', 'on', true);
  DELETE FROM guardians WHERE child_id = child AND guardian_id = me;
  DELETE FROM circles
   WHERE (owner_id = child AND member_id = me) OR (owner_id = me AND member_id = child);
END;
$$;
REVOKE ALL ON FUNCTION public.end_guardianship(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.end_guardianship(UUID) TO authenticated;

-- NOTE for delete_my_account (supabase/launch_prep.sql): add
--   PERFORM set_config('artemis.child_lock_bypass', 'on', true);
-- before it deletes circle rows, or a child account cannot delete itself.
-- That file also still names a `circle` table that does not exist — fix both
-- together before relying on account deletion.
