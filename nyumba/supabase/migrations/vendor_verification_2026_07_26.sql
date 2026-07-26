-- Phase 13b: Vendor verification columns
-- Run this in Supabase SQL Editor

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS verification_status TEXT    NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS verified_by         UUID    REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT;

CREATE INDEX IF NOT EXISTS idx_vendors_verification ON vendors(org_id, verification_status);

-- Verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'vendors'
  AND column_name IN ('verification_status', 'verified_by', 'verified_at', 'rejection_reason')
ORDER BY ordinal_position;
