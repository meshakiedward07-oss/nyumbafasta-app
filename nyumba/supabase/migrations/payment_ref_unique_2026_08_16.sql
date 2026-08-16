-- payment_ref_unique_2026_08_16.sql
-- Enforce uniqueness of payment_ref on contact_unlocks at the DB layer.
-- UUID generation makes collisions astronomically unlikely but the DB
-- constraint is the correct authoritative guard — not application code.
-- Partial: NULL payment_ref rows are excluded (pre-payment records).

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlocks_payment_ref_unique
  ON contact_unlocks (payment_ref)
  WHERE payment_ref IS NOT NULL;
