-- ============================================================================
--  Server-side safety watchdog — schema half.
--
--  Until now every dead-man's switch in Artemis lived in a setTimeout inside a
--  mounted screen: the trip ETA escalation, and the safety timer's auto-alarm.
--  If the phone locked, the app was swiped away, or the battery died, nothing
--  fired — exactly the situations the features exist for.
--
--  This adds the state the server needs to enforce those deadlines itself:
--    · trips.eta_at       — the ETA as a real timestamp, not an "HH:MM" string
--                           the client has to re-derive from started_at.
--    · trips.escalated_at — escalation as a FLAG on a live trip, not a terminal
--                           status. An escalated trip must keep broadcasting
--                           location; ending it stopped the very thing the alert
--                           tells the follower to go and look at.
--    · safety_timers      — the timer deadline, previously only in the device's
--                           AsyncStorage, where no server could ever see it.
--
--  The matching edge function is supabase/functions/watchdog/index.ts, scheduled
--  at the bottom of this file. Run in the Supabase SQL Editor. Idempotent.
-- ============================================================================

-- ── Trips ───────────────────────────────────────────────────────────────────
ALTER TABLE trips ADD COLUMN IF NOT EXISTS eta_at       TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- The watchdog scans for active, un-escalated, overdue trips every minute.
CREATE INDEX IF NOT EXISTS trips_watchdog_idx
  ON trips (eta_at)
  WHERE status = 'active' AND escalated_at IS NULL;

-- NOTE: eta_at is deliberately NOT backfilled for trips already in flight. The
-- old `eta` column is an "HH:MM" string the client resolved against the DEVICE's
-- clock; resolving it here would use the server session's timezone (UTC) and
-- land 1–2 h off for Swedish users. Escalating early is a false alarm sent to a
-- real person, so those trips keep the in-app behaviour and every trip started
-- after this migration gets watchdog cover.

-- Followers already have UPDATE on trips they follow (trips_buddy_update), and
-- the traveller owns their own row, so no new policy is needed for escalated_at.

-- ── Safety timers ───────────────────────────────────────────────────────────
-- One live timer per user; starting a new one replaces it.
CREATE TABLE IF NOT EXISTS safety_timers (
  user_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set by the watchdog when it raises the alarm, so a timer is never fired
  -- twice if a scan overlaps the next one.
  fired_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS safety_timers_due_idx
  ON safety_timers (expires_at)
  WHERE fired_at IS NULL;

ALTER TABLE safety_timers ENABLE ROW LEVEL SECURITY;

-- A timer is private to its owner. The watchdog runs with the service role and
-- bypasses RLS entirely.
DROP POLICY IF EXISTS safety_timers_owner_all ON safety_timers;
CREATE POLICY safety_timers_owner_all ON safety_timers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Schedule ────────────────────────────────────────────────────────────────
-- Deploy the function first:
--   npx supabase functions deploy watchdog --project-ref pbqcsgthnwaqpddsucrx
--
-- Then PASTE YOUR service_role KEY below and run this file. The key is baked
-- into the scheduled command, so there is nothing to configure afterwards and
-- no session to reconnect. Use service_role, not anon — the watchdog has to read
-- every user's trips.
-- Find it at: Dashboard → Project Settings → API → service_role, "secret".
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Every minute. The grace period is 5 minutes, so worst-case lateness is ~1 min.
DO $do$
DECLARE
  -- ── FILL THIS IN ──────────────────────────────────────────────────────────
  url text := 'https://pbqcsgthnwaqpddsucrx.supabase.co/functions/v1/watchdog';
  key text := 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';
  -- ──────────────────────────────────────────────────────────────────────────
BEGIN
  IF key LIKE 'PASTE_%' THEN
    RAISE EXCEPTION 'Paste your service_role key into the `key` variable above, then run this file again.';
  END IF;

  BEGIN
    PERFORM cron.unschedule('artemis-watchdog');
  EXCEPTION WHEN OTHERS THEN NULL;   -- not scheduled yet
  END;

  PERFORM cron.schedule(
    'artemis-watchdog',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
      url,
      json_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || key
      )::text,
      '{}'
    )
  );
END
$do$;

-- Check it's running (should gain a row a minute, status 'succeeded'):
--   SELECT status, return_message, start_time
--     FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'artemis-watchdog')
--    ORDER BY start_time DESC LIMIT 5;
