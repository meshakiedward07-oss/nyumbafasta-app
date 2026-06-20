-- Staff permissions + activity logging
-- Run in Supabase SQL Editor
-- Date: 2026-06-20

-- ── 1. Permissions per staff member ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, permission_key)
);

COMMENT ON TABLE staff_permissions IS
  'Granted permission modules per staff member.
   permission_key must match STAFF_PERMISSIONS keys in lib/staff/permissions.ts.
   Admin users implicitly have all permissions and do NOT appear in this table.';

CREATE INDEX IF NOT EXISTS idx_sp_staff    ON staff_permissions (staff_id);
CREATE INDEX IF NOT EXISTS idx_sp_perm_key ON staff_permissions (permission_key);

-- ── 2. Staff activity log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type   TEXT NOT NULL,
  -- 'lead_stage_update'|'whatsapp_takeover'|'comment_moderated'
  -- |'violation_resolved'|'scraper_run'
  resource_type TEXT,
  resource_id   TEXT,
  description   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sal_staff   ON staff_activity_log (staff_id);
CREATE INDEX IF NOT EXISTS idx_sal_created ON staff_activity_log (created_at DESC);

-- ── 3. role_template column on users (optional label for quick reference) ─────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_template TEXT;

COMMENT ON COLUMN users.role_template IS
  'Optional label matching STAFF_ROLE_TEMPLATES keys in lib/staff/permissions.ts.
   Actual access is controlled by staff_permissions table, not this column.';

-- ── 4. RLS for staff_permissions (admin only — staff cannot see their own rows
--        directly; they use /api/v1/staff/me/permissions which uses service role)
ALTER TABLE staff_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_staff_permissions" ON staff_permissions;
CREATE POLICY "admin_manage_staff_permissions" ON staff_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 5. RLS for staff_activity_log (admin read all; staff read own) ────────────
ALTER TABLE staff_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_activity" ON staff_activity_log;
CREATE POLICY "admin_read_activity" ON staff_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_read_own_activity" ON staff_activity_log;
CREATE POLICY "staff_read_own_activity" ON staff_activity_log
  FOR SELECT USING (staff_id = auth.uid());
