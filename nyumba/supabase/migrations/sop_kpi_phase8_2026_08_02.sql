-- Phase 8: Scorecard snapshot history
-- Stores one row per department per day so we can track KPI trends over time.
-- UNIQUE (snapped_at, owner_role) lets us safely upsert daily from the cron.

CREATE TABLE IF NOT EXISTS scorecard_snapshots (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  snapped_at  DATE    NOT NULL DEFAULT CURRENT_DATE,
  owner_role  TEXT    NOT NULL,
  department  TEXT    NOT NULL,
  score       SMALLINT NOT NULL,
  overall     TEXT    NOT NULL CHECK (overall IN ('good', 'warning', 'critical')),
  open_alerts SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (snapped_at, owner_role)
);

CREATE INDEX IF NOT EXISTS idx_scorecard_snapshots_lookup
  ON scorecard_snapshots (owner_role, snapped_at DESC);

-- RLS: only service role can write; authenticated admins/staff can read
ALTER TABLE scorecard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin staff can read snapshots"
  ON scorecard_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
    )
  );
