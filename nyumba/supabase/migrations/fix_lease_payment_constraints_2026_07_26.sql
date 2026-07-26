-- ═══════════════════════════════════════════════════════════════════════════
-- Fix lease_payments: status + payment_method constraints for rent collection
-- Date: 2026-07-26
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (all idempotent via DROP CONSTRAINT IF EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Fix status CHECK — add proof_uploaded, void, late
--    Original constraint only had: pending | paid | late | partial | waived
--    Rent collection features require: proof_uploaded, void
--    Without this fix, proof uploads and void actions fail with constraint errors.

ALTER TABLE lease_payments DROP CONSTRAINT IF EXISTS lease_payments_status_check;
ALTER TABLE lease_payments
  ADD CONSTRAINT lease_payments_status_check
  CHECK (status IN ('pending','paid','late','partial','waived','proof_uploaded','void'));

-- 2. Drop payment_method CHECK constraint — the column is TEXT, no restriction needed.
--    Original constraint: ('mpesa','cash','bank_transfer','airtel','tigo')
--    Mark-paid modal now uses 'bank', 'halopesa', etc. — widen it to unrestricted TEXT.

ALTER TABLE lease_payments DROP CONSTRAINT IF EXISTS lease_payments_payment_method_check;

-- 3. Add updated_at column if not already present (used by void + mark_paid)
ALTER TABLE lease_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Verify the constraints are correct
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'lease_payments'::regclass
  AND contype = 'c'
ORDER BY conname;
