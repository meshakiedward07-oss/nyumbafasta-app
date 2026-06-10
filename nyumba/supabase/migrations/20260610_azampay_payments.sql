-- AzamPay payments table for tracking all payment transactions
-- Note: contact_unlocks and subscriptions tables already exist with payment fields.
-- This table provides a unified payment audit trail.

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  transaction_id TEXT,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'TZS',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  type TEXT NOT NULL CHECK (type IN ('unlock','subscription','extra_listings','boost')),
  provider TEXT,
  customer_phone TEXT,
  dalali_id UUID REFERENCES users(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  reference_id UUID, -- contact_unlock.id or subscription.id
  webhook_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_dalali_id ON payments(dalali_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON payments USING (false) WITH CHECK (false);
