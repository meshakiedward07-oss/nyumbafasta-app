-- ============================================================
-- Rent Collection System — Manual migration
-- Run this in Supabase SQL Editor before deploying the feature
-- ============================================================

-- 1. Organization banking details (one row per org)
CREATE TABLE IF NOT EXISTS organization_banking (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name               TEXT NOT NULL,
  account_name            TEXT NOT NULL,
  account_number          TEXT NOT NULL,
  branch                  TEXT,
  mobile_money_number     TEXT,
  mobile_money_provider   TEXT,    -- 'mpesa' | 'airtel' | 'tigo' | 'halopesa'
  additional_instructions TEXT,
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_banking_org_id_key UNIQUE (org_id)
);

-- Enable RLS
ALTER TABLE organization_banking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read banking" ON organization_banking
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- 2. Extend lease_payments for invoice/proof/verify flow
ALTER TABLE lease_payments
  ADD COLUMN IF NOT EXISTS invoice_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_url           TEXT,
  ADD COLUMN IF NOT EXISTS proof_note          TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by         UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ;

-- Index to speed up "unsent invoices" cron query
CREATE INDEX IF NOT EXISTS idx_lease_payments_unsent
  ON lease_payments (status, invoice_sent_at)
  WHERE status = 'pending' AND invoice_sent_at IS NULL;

-- Index to speed up "overdue" cron query
CREATE INDEX IF NOT EXISTS idx_lease_payments_overdue
  ON lease_payments (status, due_date)
  WHERE status = 'pending';
