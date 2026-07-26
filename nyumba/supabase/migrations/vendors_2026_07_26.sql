-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 13: Vendor Directory
-- Date: 2026-07-26
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (all idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vendors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'other',
  phone           TEXT,
  email           TEXT,
  specialty       TEXT,
  location        TEXT,
  notes           TEXT,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  jobs_completed  INTEGER     NOT NULL DEFAULT 0,
  rating_avg      NUMERIC(3,1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_org_id   ON vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(org_id, category);
CREATE INDEX IF NOT EXISTS idx_vendors_active   ON vendors(org_id, is_active);

-- Add vendor link to maintenance requests
ALTER TABLE maintenance_requests
  ADD COLUMN IF NOT EXISTS vendor_id           UUID REFERENCES vendors(id),
  ADD COLUMN IF NOT EXISTS vendor_notified_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mr_vendor ON maintenance_requests(vendor_id);

-- Verify
SELECT table_name FROM information_schema.tables WHERE table_name = 'vendors';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'maintenance_requests'
  AND column_name IN ('vendor_id', 'vendor_notified_at');
