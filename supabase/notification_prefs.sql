-- Notification preferences per user.
-- Each key defaults to true (all notifications enabled).
-- Run in Supabase SQL Editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  DEFAULT '{"wellness":true,"circle":true,"alarm":true,"trips":true,"messages":true}'::jsonb;
