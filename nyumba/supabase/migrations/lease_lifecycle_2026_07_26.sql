-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 12: Lease Lifecycle — new columns for renewal, termination, deposit refund
-- Date: 2026-07-26
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (all idempotent via ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Renewal tracking
ALTER TABLE leases ADD COLUMN IF NOT EXISTS renewed_at     TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS renewal_count  INTEGER NOT NULL DEFAULT 0;

-- Termination tracking
ALTER TABLE leases ADD COLUMN IF NOT EXISTS terminated_at  TIMESTAMPTZ;

-- Deposit refund tracking
ALTER TABLE leases ADD COLUMN IF NOT EXISTS deposit_refund_amount NUMERIC(12,2);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS deposit_refunded_at   TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS deposit_refund_notes  TEXT;

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'leases'
  AND column_name IN (
    'renewed_at','renewal_count','terminated_at',
    'deposit_refund_amount','deposit_refunded_at','deposit_refund_notes'
  )
ORDER BY column_name;
