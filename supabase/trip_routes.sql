-- Trip routing: real destination coords, route geometry, and live remaining
-- distance/time (updated by the traveler as they move, read by the follower).
-- Run in Supabase SQL Editor.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS route JSONB,              -- [[lng,lat], ...] route geometry
  ADD COLUMN IF NOT EXISTS distance_m REAL,          -- total route distance at start
  ADD COLUMN IF NOT EXISTS duration_s REAL,          -- total route duration at start
  ADD COLUMN IF NOT EXISTS remaining_m REAL,         -- live: metres left
  ADD COLUMN IF NOT EXISTS remaining_s REAL;         -- live: seconds left
