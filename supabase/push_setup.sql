-- push_setup.sql — run in the Supabase SQL Editor before deploying push notifications.
--
-- 1. Adds push_token column to profiles (stores Expo push token per device).
-- 2. After running this, deploy the 'notify' edge function and set up two
--    Database Webhooks in Supabase Dashboard → Database → Webhooks:
--      • Table: check_ins  Event: INSERT  URL: .../functions/v1/notify
--      • Table: invites    Event: INSERT  URL: .../functions/v1/notify
--    Add header: Authorization: Bearer <service_role_key>

alter table public.profiles
  add column if not exists push_token text default null;
