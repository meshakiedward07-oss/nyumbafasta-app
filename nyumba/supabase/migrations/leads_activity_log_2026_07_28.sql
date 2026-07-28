-- ── Leads Activity Log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name    text,
  action_type   text NOT NULL,
  old_value     text,
  new_value     text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_activity_log_lead_id_idx ON lead_activity_log(lead_id);
CREATE INDEX IF NOT EXISTS lead_activity_log_created_at_idx ON lead_activity_log(created_at DESC);

ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lead_activity_log' AND policyname = 'Admin/staff read activity'
  ) THEN
    CREATE POLICY "Admin/staff read activity" ON lead_activity_log FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lead_activity_log' AND policyname = 'Admin/staff insert activity'
  ) THEN
    CREATE POLICY "Admin/staff insert activity" ON lead_activity_log FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
  END IF;
END $$;

-- ── Add linked_user_id column to leads ────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- ── Add registered_at column if missing ───────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS registered_at timestamptz;
