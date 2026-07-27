-- ============================================================
-- Expand income_records.source to cover brokerage commission
-- and org subscription payments
-- Run in Supabase SQL Editor
-- 2026-07-27
-- ============================================================

-- Drop the old CHECK constraint (name may vary — drop both possibilities)
ALTER TABLE income_records
  DROP CONSTRAINT IF EXISTS income_records_source_check;

-- Re-create with all valid sources
ALTER TABLE income_records
  ADD CONSTRAINT income_records_source_check
  CHECK (source IN (
    'subscription',
    'contact_unlock',
    'boost_listing',
    'extra_listing',
    'ad_campaign',
    'brokerage_commission',
    'org_subscription',
    'other'
  ));

-- Index to make per-source reports fast
CREATE INDEX IF NOT EXISTS idx_inc_src_date
  ON income_records (source, transaction_date DESC);
