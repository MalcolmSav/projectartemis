-- ============================================================================
--  Two load fixes. Neither changes behaviour — only how much work it costs.
--
--  1. latest_check_ins() — the app was pulling the 300 most recent check-in rows
--     it could see and reducing them client-side to "latest per user". That
--     scales with circle chatter rather than circle size, and silently goes
--     wrong past 300 rows: a quiet member's latest check-in falls off the end
--     and their status dot empties out. This returns exactly one row per user.
--
--  2. A conditional trips webhook — an active trip UPDATEs its route and
--     remaining distance every ~20 s, and every one of those fired the notify
--     edge function. It early-returns, but that's still ~180 pointless
--     invocations per hour per active trip. The trigger now only fires on the
--     three transitions notify actually handles.
--
--  Run in the Supabase SQL Editor, AFTER safety_watchdog.sql — the trigger below
--  references trips.escalated_at, which that file adds. Idempotent.
-- ============================================================================

-- ── 1. One check-in per user, server-side ───────────────────────────────────
-- SECURITY DEFINER only to make DISTINCT ON cheap; the WHERE clause reproduces
-- the checkins_select RLS policy exactly, so it exposes nothing extra.
CREATE OR REPLACE FUNCTION public.latest_check_ins()
RETURNS SETOF public.check_ins
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (c.user_id) c.*
  FROM public.check_ins c
  WHERE c.user_id = auth.uid()
     OR c.target_id = auth.uid()
     -- Spelled out rather than calling is_circle_member(c.user_id): identical
     -- result, but a set the planner can hash-join instead of a function call
     -- evaluated per row.
     OR c.user_id IN (SELECT m.member_id FROM public.circles m WHERE m.owner_id = auth.uid())
  ORDER BY c.user_id, c.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.latest_check_ins() FROM public;
GRANT EXECUTE ON FUNCTION public.latest_check_ins() TO authenticated;

-- Supports both the DISTINCT ON above and the app's "my most recent 'ok'" probe.
CREATE INDEX IF NOT EXISTS check_ins_user_created_idx
  ON public.check_ins (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS check_ins_target_created_idx
  ON public.check_ins (target_id, created_at DESC)
  WHERE target_id IS NOT NULL;

-- ── 2. Fire the trips webhook only on transitions notify handles ────────────
--
--  BEFORE RUNNING THIS: delete the existing trips UPDATE webhook in
--  Dashboard → Database → Webhooks. Otherwise both triggers fire and every
--  notification goes out twice. The INSERT webhook on trips stays as it is.
--
--  Paste your service_role key below — the same one you used in
--  safety_watchdog.sql. It's baked into the trigger definition, so there's
--  nothing to configure afterwards.
--  Find it at: Dashboard → Project Settings → API → service_role, "secret".
DO $do$
DECLARE
  -- ── FILL THIS IN ──────────────────────────────────────────────────────────
  url text := 'https://pbqcsgthnwaqpddsucrx.supabase.co/functions/v1/notify';
  key text := 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';
  -- ──────────────────────────────────────────────────────────────────────────
BEGIN
  IF key LIKE 'PASTE_%' THEN
    RAISE EXCEPTION 'Paste your service_role key into the `key` variable above, then run this file again.';
  END IF;

  EXECUTE 'DROP TRIGGER IF EXISTS trips_notify_webhook ON public.trips';

  EXECUTE format(
    'CREATE TRIGGER trips_notify_webhook
       AFTER UPDATE ON public.trips
       FOR EACH ROW
       WHEN (
            OLD.status       IS DISTINCT FROM NEW.status
         OR OLD.followed_at  IS DISTINCT FROM NEW.followed_at
         OR OLD.escalated_at IS DISTINCT FROM NEW.escalated_at
       )
       EXECUTE FUNCTION supabase_functions.http_request(%L, %L, %L, %L, %L)',
    url,
    'POST',
    json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || key
    )::text,
    '{}',
    '5000'
  );
END
$do$;
