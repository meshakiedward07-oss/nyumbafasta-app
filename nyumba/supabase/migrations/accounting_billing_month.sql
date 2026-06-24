-- NyumbaFasta — Accounting: billing_month support + monthly summary view
-- Run in Supabase SQL Editor

-- ── 1. Add billing_month to income_records ─────────────────────────────────
ALTER TABLE income_records
  ADD COLUMN IF NOT EXISTS billing_month TEXT;
  -- e.g. '2026-06' for June 2026

-- Backfill from existing year/month columns
UPDATE income_records
SET billing_month = LPAD(year::TEXT, 4, '0') || '-' || LPAD(month::TEXT, 2, '0')
WHERE billing_month IS NULL
  AND year IS NOT NULL AND month IS NOT NULL;

-- Backfill any remaining rows from transaction_date
UPDATE income_records
SET billing_month = TO_CHAR(transaction_date::date, 'YYYY-MM')
WHERE billing_month IS NULL;

-- Index for fast month filtering
CREATE INDEX IF NOT EXISTS idx_ir_billing_month
  ON income_records(billing_month DESC);

-- ── 2. Add billing_month to expense_records ────────────────────────────────
ALTER TABLE expense_records
  ADD COLUMN IF NOT EXISTS billing_month TEXT;

UPDATE expense_records
SET billing_month = LPAD(year::TEXT, 4, '0') || '-' || LPAD(month::TEXT, 2, '0')
WHERE billing_month IS NULL
  AND year IS NOT NULL AND month IS NOT NULL;

UPDATE expense_records
SET billing_month = TO_CHAR(expense_date::date, 'YYYY-MM')
WHERE billing_month IS NULL;

CREATE INDEX IF NOT EXISTS idx_er_billing_month
  ON expense_records(billing_month DESC);

-- ── 3. Monthly financial summary view ─────────────────────────────────────
CREATE OR REPLACE VIEW monthly_financial_summary AS
SELECT
  ir.billing_month,
  EXTRACT(YEAR  FROM MIN(ir.transaction_date))::INTEGER AS year,
  EXTRACT(MONTH FROM MIN(ir.transaction_date))::INTEGER AS month,

  -- Totals
  COUNT(ir.id)                          AS transaction_count,
  COALESCE(SUM(ir.amount_tzs),      0)  AS gross_income,
  COALESCE(SUM(ir.platform_fee_tzs),0)  AS platform_fees,
  COALESCE(SUM(ir.net_amount_tzs),  0)  AS net_income,

  -- Income by source
  COALESCE(SUM(CASE WHEN ir.source = 'subscription'   THEN ir.amount_tzs END), 0) AS subscription_income,
  COALESCE(SUM(CASE WHEN ir.source = 'contact_unlock' THEN ir.amount_tzs END), 0) AS contact_unlock_income,
  COALESCE(SUM(CASE WHEN ir.source = 'boost_listing'  THEN ir.amount_tzs END), 0) AS boost_income,
  COALESCE(SUM(CASE WHEN ir.source = 'extra_listing'  THEN ir.amount_tzs END), 0) AS extra_listing_income,
  COALESCE(SUM(CASE WHEN ir.source = 'other'          THEN ir.amount_tzs END), 0) AS other_income
FROM income_records ir
WHERE ir.billing_month IS NOT NULL
GROUP BY ir.billing_month
ORDER BY ir.billing_month DESC;

-- Verify view works
-- SELECT * FROM monthly_financial_summary LIMIT 6;

-- Current month stats
-- SELECT * FROM monthly_financial_summary
-- WHERE billing_month = TO_CHAR(NOW(), 'YYYY-MM');

-- ── 4. Recurring expenses function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_expenses(
  target_month TEXT  -- 'YYYY-MM'
)
RETURNS TABLE (
  id            UUID,
  category      TEXT,
  description   TEXT,
  amount_tzs    NUMERIC,
  is_recurring  BOOLEAN,
  billing_month TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Actual expense records for this month
  SELECT
    er.id,
    er.category,
    er.description,
    er.amount_tzs,
    er.is_recurring,
    er.billing_month
  FROM expense_records er
  WHERE er.billing_month = target_month

  UNION ALL

  -- Auto-include active recurring expenses not yet recorded this month
  SELECT
    gen_random_uuid(),
    re.category,
    re.description,
    re.amount_tzs,
    true,
    target_month
  FROM recurring_expenses re
  WHERE re.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM expense_records er2
      WHERE er2.billing_month = target_month
        AND er2.description   = re.description
        AND er2.is_recurring  = true
    );
END;
$$ LANGUAGE plpgsql;
