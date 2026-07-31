-- finance_gaps_2026_07_31.sql
-- Fills all missing financial system gaps across admin, org, and dalali

-- ── 1. Organization expenses table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_tzs      NUMERIC(12, 2) NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('maintenance','utilities','salaries','marketing','legal','insurance','taxes','office','other')),
  description     TEXT NOT NULL,
  vendor          TEXT,
  receipt_url     TEXT,
  expense_date    DATE NOT NULL,
  payment_method  TEXT DEFAULT 'cash'
    CHECK (payment_method IN ('cash','mpesa','airtel','bank_transfer','cheque','other')),
  notes           TEXT,
  recorded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_expenses_org_id   ON org_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_expenses_date     ON org_expenses(expense_date);

ALTER TABLE org_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage org expenses" ON org_expenses;
CREATE POLICY "Org members can manage org expenses"
  ON org_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = org_expenses.organization_id
        AND organization_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')
    )
  );

-- ── 2. dalali_expenses: add receipt_url ──────────────────────────────────────
ALTER TABLE dalali_expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- ── 3. lease_payments: add late fee columns ──────────────────────────────────
ALTER TABLE lease_payments ADD COLUMN IF NOT EXISTS late_fee_amount     NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE lease_payments ADD COLUMN IF NOT EXISTS late_fee_applied_at TIMESTAMPTZ;

-- ── 4. dalali_invoices ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalali_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dalali_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_name    TEXT NOT NULL,
  client_phone   TEXT,
  client_email   TEXT,
  issue_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  status         TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','cancelled')),
  subtotal_tzs   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_tzs        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_tzs      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dalali_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS dalali_invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES dalali_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(8, 2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10, 2) NOT NULL,
  amount      NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dalali_invoices_dalali_id ON dalali_invoices(dalali_id);
CREATE INDEX IF NOT EXISTS idx_dalali_invoices_status    ON dalali_invoices(status);
CREATE INDEX IF NOT EXISTS idx_dalali_invoice_items_inv  ON dalali_invoice_items(invoice_id);

ALTER TABLE dalali_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalali_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dalali can manage own invoices"       ON dalali_invoices;
DROP POLICY IF EXISTS "Admin can view all dalali invoices"   ON dalali_invoices;
DROP POLICY IF EXISTS "Dalali can manage own invoice items"  ON dalali_invoice_items;
DROP POLICY IF EXISTS "Admin can view all invoice items"     ON dalali_invoice_items;

CREATE POLICY "Dalali can manage own invoices"
  ON dalali_invoices FOR ALL
  USING (dalali_id = auth.uid());

CREATE POLICY "Admin can view all dalali invoices"
  ON dalali_invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));

CREATE POLICY "Dalali can manage own invoice items"
  ON dalali_invoice_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM dalali_invoices WHERE id = dalali_invoice_items.invoice_id AND dalali_id = auth.uid())
  );

CREATE POLICY "Admin can view all invoice items"
  ON dalali_invoice_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));

-- Helper: next sequential invoice number per dalali
CREATE OR REPLACE FUNCTION next_dalali_invoice_number(p_dalali_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INT)), 0) + 1
    INTO v_count
    FROM dalali_invoices
   WHERE dalali_id = p_dalali_id;
  RETURN 'INV-' || LPAD(v_count::TEXT, 3, '0');
END;
$$;
