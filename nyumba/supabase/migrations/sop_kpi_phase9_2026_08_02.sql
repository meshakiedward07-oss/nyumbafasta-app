-- Phase 9: SOP Staff Acknowledgement
-- Tracks which users have acknowledged (read + understood) each internal SOP.
-- sop_version stores last_reviewed_at at time of ack so we can detect stale acks.
-- UNIQUE (sop_id, user_id) → upsert pattern on re-acknowledgement.

CREATE TABLE IF NOT EXISTS sop_acknowledgements (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sop_id          UUID        NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sop_version     TIMESTAMPTZ,        -- last_reviewed_at value when acknowledged
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (sop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_ack_sop_id  ON sop_acknowledgements (sop_id);
CREATE INDEX IF NOT EXISTS idx_sop_ack_user_id ON sop_acknowledgements (user_id);

ALTER TABLE sop_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Users can manage their own acknowledgement
CREATE POLICY "own ack insert"  ON sop_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own ack update"  ON sop_acknowledgements FOR UPDATE TO authenticated USING (user_id = auth.uid());
-- Admin and staff can read all acknowledgements (for scorecards + knowledge admin)
CREATE POLICY "admin staff read" ON sop_acknowledgements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
    )
  );
