-- income_manual_2026_08_07.sql
-- Manual income entries: for payments received outside the platform.
-- Tenants can upload a receipt; AI extracts details; org approves.
-- Also adds ai_extracted to lease_payments so proof uploads carry parsed data.

-- ── org_income_entries ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_income_entries (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Who submitted (could be an org member or a tenant)
  submitted_by      uuid        REFERENCES auth.users(id),
  submitted_by_role text        NOT NULL DEFAULT 'org',  -- 'org' | 'tenant'

  -- Optional link to the lease this income relates to
  lease_id          uuid        REFERENCES leases(id),

  -- Financial details
  amount_tzs        numeric     NOT NULL,
  payment_date      date        NOT NULL,
  payment_method    text        NOT NULL DEFAULT 'cash',
  reference_number  text,
  description       text        NOT NULL DEFAULT '',

  -- Receipt evidence
  receipt_url       text,
  ai_extracted      jsonb,      -- raw data from Claude vision: { amount, date, reference, method, payer }

  -- Approval flow
  status            text        NOT NULL DEFAULT 'approved',
  -- 'pending_review'  → submitted by tenant, awaiting org
  -- 'approved'        → confirmed by org (or org entered it directly)
  -- 'rejected'        → org rejected
  reviewed_by       uuid        REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  rejection_reason  text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS: org members can read their entries; admin/staff can read all
ALTER TABLE org_income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read own entries"
  ON org_income_entries FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Tenants read entries they submitted"
  ON org_income_entries FOR SELECT
  USING (submitted_by = auth.uid());

-- ── Extend lease_payments with ai_extracted ───────────────────────────────────
ALTER TABLE lease_payments ADD COLUMN IF NOT EXISTS ai_extracted jsonb;

-- ── Index for fast lookups ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_income_org_id     ON org_income_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_org_income_status     ON org_income_entries(status);
CREATE INDEX IF NOT EXISTS idx_org_income_lease      ON org_income_entries(lease_id);
CREATE INDEX IF NOT EXISTS idx_org_income_payment_date ON org_income_entries(payment_date DESC);
