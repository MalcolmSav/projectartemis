-- Battery level on presence rows.
-- Shown in circle member cards so you can distinguish "no response" from "dead battery".
ALTER TABLE presence
  ADD COLUMN IF NOT EXISTS battery_level REAL;  -- 0.0–1.0, null = unknown

-- Seen receipts on wellness checks.
-- Updated by the target when WellnessIncomingScreen loads.
ALTER TABLE check_ins
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

-- RLS: allow the target to mark their own wellness check as seen.
-- (assumes existing RLS on check_ins already exists)
CREATE OR REPLACE FUNCTION mark_wellness_seen(check_in_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE check_ins
  SET seen_at = NOW()
  WHERE id = check_in_id
    AND target_id = auth.uid()
    AND kind = 'wellness_request'
    AND seen_at IS NULL;
END;
$$;
