-- Webhook idempotency: ensure payment_ref is unique across all payment tables
-- so duplicate webhook calls cannot create duplicate records at the DB level.
-- Run this in the Supabase SQL editor.

-- contact_unlocks: one unlock per payment_ref
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlocks_payment_ref
  ON contact_unlocks(payment_ref);

-- subscriptions: one subscription per payment_ref
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_payment_ref
  ON subscriptions(payment_ref);

-- boost_payments: one boost per payment_ref
CREATE UNIQUE INDEX IF NOT EXISTS idx_boost_payments_payment_ref
  ON boost_payments(payment_ref);

-- payments table: external_id already UNIQUE per schema — this is the guard for extra_listings

-- Indexes for webhook lookup performance (payment_ref lookups happen on every webhook)
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_status
  ON contact_unlocks(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_ref_status
  ON subscriptions(payment_ref, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_boost_payments_payment_ref_status
  ON boost_payments(payment_ref, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payments_external_status
  ON payments(external_id, status) WHERE status = 'pending';
