-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions Phase 3 — Manual Billing Invoices
-- Run AFTER subscriptions_phase1.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id           uuid        REFERENCES subscription_plans(id) ON DELETE SET NULL,
  amount_tzs        integer     NOT NULL CHECK (amount_tzs >= 0),
  billing_cycle     text        NOT NULL DEFAULT 'monthly'
                                CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  -- pending → proof_uploaded → confirmed | void
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'proof_uploaded', 'confirmed', 'void')),
  due_date          date,
  notes             text,
  -- Payment instructions snapshot at invoice creation
  payment_reference text,
  -- Proof of payment (org uploads)
  proof_url         text,
  proof_note        text,
  proof_uploaded_at timestamptz,
  -- Admin action
  confirmed_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at      timestamptz,
  voided_by         uuid        REFERENCES users(id) ON DELETE SET NULL,
  voided_at         timestamptz,
  void_reason       text,
  -- Audit
  created_by        uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_invoices_org_id_idx
  ON subscription_invoices(org_id);
CREATE INDEX IF NOT EXISTS subscription_invoices_status_idx
  ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS subscription_invoices_created_at_idx
  ON subscription_invoices(created_at DESC);

ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Org members can read their own invoices
DROP POLICY IF EXISTS "invoices_org_read" ON subscription_invoices;
CREATE POLICY "invoices_org_read" ON subscription_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff')
    )
  );

-- Org owner can upload proof (update proof fields only)
DROP POLICY IF EXISTS "invoices_org_proof_upload" ON subscription_invoices;
CREATE POLICY "invoices_org_proof_upload" ON subscription_invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
        AND om.user_id = auth.uid()
        AND om.role = 'owner'
    )
  )
  WITH CHECK (status IN ('pending', 'proof_uploaded'));

-- Admin/staff full control
DROP POLICY IF EXISTS "invoices_admin_all" ON subscription_invoices;
CREATE POLICY "invoices_admin_all" ON subscription_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'staff')
    )
  );
