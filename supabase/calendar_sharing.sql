-- Calendar sharing — the missing server side.
-- The app already has the full UI (share sheet writes calendar_shares, the
-- Calendar tab renders a "Shared with you" section), but no RLS policy ever
-- allowed a viewer to SELECT another user's events, so shared calendars always
-- came back empty. Run in Supabase SQL Editor. Idempotent.

-- Table (already exists in prod if the share sheet has been used — safe).
CREATE TABLE IF NOT EXISTS calendar_shares (
  owner_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level     TEXT NOT NULL DEFAULT 'none' CHECK (level IN ('none', 'checkin', 'full')),
  PRIMARY KEY (owner_id, viewer_id)
);

ALTER TABLE calendar_shares ENABLE ROW LEVEL SECURITY;

-- Owner manages their own share settings.
DROP POLICY IF EXISTS calshares_owner_all ON calendar_shares;
CREATE POLICY calshares_owner_all ON calendar_shares
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Viewer can see rows granting THEM access (needed for realtime + UI).
DROP POLICY IF EXISTS calshares_viewer_select ON calendar_shares;
CREATE POLICY calshares_viewer_select ON calendar_shares
  FOR SELECT USING (auth.uid() = viewer_id);

-- THE FIX: viewers may read an owner's events according to the share level.
--   'full'    → all of the owner's events
--   'checkin' → only events flagged "check-in expected" (the safety-relevant ones)
--   'none'    → nothing
-- This is an additional permissive SELECT policy — it ORs with the existing
-- owner-only policy, so owners keep seeing their own events unchanged.
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
