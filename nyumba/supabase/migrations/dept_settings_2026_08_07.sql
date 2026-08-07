-- dept_settings_2026_08_07.sql
-- Stores admin-configurable SOP links and KPI targets per department.
-- Safe to re-run: IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS department_settings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_role      text        NOT NULL UNIQUE,  -- admin | staff | sales | finance | marketing

  -- Responsible person
  owner_name      text,

  -- SOP configuration
  sop_title       text,
  sop_url         text,
  sop_review_days int         NOT NULL DEFAULT 30,
  sop_last_reviewed_at timestamptz,

  -- KPI targets — array of { label, target, unit, notes }
  kpi_targets     jsonb       NOT NULL DEFAULT '[]',

  -- General notes / goals for the department
  goal_notes      text,

  updated_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_settings_role ON department_settings(owner_role);

ALTER TABLE department_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin staff manage dept settings" ON department_settings;
CREATE POLICY "Admin staff manage dept settings"
  ON department_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- Seed default rows for each department
INSERT INTO department_settings (owner_role, sop_title, kpi_targets) VALUES
  ('admin',     'SOP ya Uthibitisho', '[]'),
  ('staff',     'SOP ya Msaada',      '[]'),
  ('sales',     'SOP ya Mauzo',       '[]'),
  ('finance',   'SOP ya Fedha',       '[]'),
  ('marketing', 'SOP ya Masoko',      '[]')
ON CONFLICT (owner_role) DO NOTHING;
