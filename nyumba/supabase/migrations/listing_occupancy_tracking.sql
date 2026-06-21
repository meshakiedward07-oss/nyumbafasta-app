-- Occupancy/Capacity Tracking for listings
-- Run in Supabase SQL Editor
-- Date: 2026-06-21

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listing_unit_type TEXT DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS total_capacity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_deactivate_on_full BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS occupancy_last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_deactivated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS listing_occupancy_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  previous_occupancy INTEGER,
  new_occupancy INTEGER,
  changed_by UUID REFERENCES users(id),   -- NOTE: users not profiles
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lol_listing ON listing_occupancy_log(listing_id);
CREATE INDEX IF NOT EXISTS idx_lol_changed_by ON listing_occupancy_log(changed_by);

-- RLS for occupancy log
ALTER TABLE listing_occupancy_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dalali_read_own_occupancy_log" ON listing_occupancy_log;
CREATE POLICY "dalali_read_own_occupancy_log" ON listing_occupancy_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_occupancy_log.listing_id
        AND dalali_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "system_insert_occupancy_log" ON listing_occupancy_log;
CREATE POLICY "system_insert_occupancy_log" ON listing_occupancy_log
  FOR INSERT WITH CHECK (true);

-- Trigger function to auto-deactivate when full
CREATE OR REPLACE FUNCTION check_listing_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_occupancy >= NEW.total_capacity
     AND NEW.auto_deactivate_on_full = true
     AND NEW.status = 'active' THEN
    NEW.status := 'taken';
    NEW.auto_deactivated_at := NOW();
  END IF;
  NEW.occupancy_last_updated := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_capacity ON listings;
CREATE TRIGGER trg_check_capacity
  BEFORE UPDATE OF current_occupancy ON listings
  FOR EACH ROW
  WHEN (NEW.current_occupancy IS DISTINCT FROM OLD.current_occupancy)
  EXECUTE FUNCTION check_listing_capacity();
