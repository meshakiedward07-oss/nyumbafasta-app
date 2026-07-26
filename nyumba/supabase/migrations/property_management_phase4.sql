-- ══════════════════════════════════════════════════════════════════════════
-- Phase 4: Maintenance Management
-- Tables: maintenance_requests, maintenance_comments
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Maintenance Requests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id         uuid        REFERENCES property_units(id) ON DELETE SET NULL,
  lease_id        uuid        REFERENCES leases(id) ON DELETE SET NULL,

  title           text        NOT NULL CHECK (char_length(title) > 0),
  description     text,
  category        text        NOT NULL DEFAULT 'other'
                              CHECK (category IN ('plumbing','electrical','structural','cleaning','security','appliance','other')),
  priority        text        NOT NULL DEFAULT 'medium'
                              CHECK (priority IN ('low','medium','high','urgent')),
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','assigned','in_progress','awaiting_parts','resolved','closed','cancelled')),

  reported_by     uuid        NOT NULL REFERENCES users(id),
  assigned_to     uuid        REFERENCES users(id),

  estimated_cost  numeric(12,2),
  actual_cost     numeric(12,2),

  images          jsonb       NOT NULL DEFAULT '[]',

  scheduled_at    timestamptz,
  resolved_at     timestamptz,

  notes           text,
  conversation_id uuid        REFERENCES conversations(id) ON DELETE SET NULL,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ── 2. Maintenance Comments / Status History ─────────────────────────────
CREATE TABLE IF NOT EXISTS maintenance_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid        NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES users(id),
  body            text        NOT NULL CHECK (char_length(body) > 0),
  is_internal     boolean     NOT NULL DEFAULT false,
  status_change   text,       -- e.g. 'open→in_progress'
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_maint_org_status   ON maintenance_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_maint_unit         ON maintenance_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_maint_lease        ON maintenance_requests(lease_id);
CREATE INDEX IF NOT EXISTS idx_maint_assigned     ON maintenance_requests(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_maint_priority     ON maintenance_requests(priority, status);
CREATE INDEX IF NOT EXISTS idx_maint_comments_req ON maintenance_comments(request_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY;

-- maintenance_requests: org members + reported_by tenant + admin/staff
DROP POLICY IF EXISTS "maint_requests_access" ON maintenance_requests;
CREATE POLICY "maint_requests_access" ON maintenance_requests FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR reported_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- maintenance_comments: same as parent request
DROP POLICY IF EXISTS "maint_comments_access" ON maintenance_comments;
CREATE POLICY "maint_comments_access" ON maintenance_comments FOR ALL TO authenticated
  USING (
    request_id IN (
      SELECT id FROM maintenance_requests
      WHERE org_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
      OR reported_by = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
  );
