-- ═══════════════════════════════════════════════════════════════
-- Fix: Payment columns missing from contact_unlocks + subscriptions
-- Date: 2026-07-07
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (all idempotent)
-- ═══════════════════════════════════════════════════════════════

-- 1. contact_unlocks — add expires_at (required by payment routes)
ALTER TABLE contact_unlocks
  ADD COLUMN IF NOT EXISTS expires_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at   TIMESTAMPTZ;

-- 2. subscriptions — update plan constraint to include 'enterprise' + 'free'
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'basic', 'premium', 'enterprise'));

-- 3. payments audit table (needed by subscription route)
CREATE TABLE IF NOT EXISTS payments (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id    TEXT         UNIQUE NOT NULL,
  transaction_id TEXT,
  amount         DECIMAL(12,2) NOT NULL,
  currency       TEXT         DEFAULT 'TZS',
  status         TEXT         DEFAULT 'pending'
                   CHECK (status IN ('pending','completed','failed','cancelled')),
  type           TEXT         NOT NULL
                   CHECK (type IN ('unlock','subscription','extra_listings','boost')),
  provider       TEXT,
  customer_phone TEXT,
  dalali_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
  listing_id     UUID         REFERENCES listings(id) ON DELETE SET NULL,
  reference_id   UUID,
  webhook_payload JSONB,
  created_at     TIMESTAMPTZ  DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_dalali_id   ON payments(dalali_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at  ON payments(created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON payments;
CREATE POLICY "Service role only" ON payments USING (false) WITH CHECK (false);

-- 4. app_settings table (for dynamic pricing)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('subscription_basic_price',      '10000'),
  ('subscription_premium_price',    '25000'),
  ('subscription_enterprise_price', '50000'),
  ('unlock_price',                  '2000'),
  ('boost_1week_price',             '5000'),
  ('boost_2week_price',             '9000'),
  ('boost_4week_price',             '16000'),
  ('extra_listing_price',           '2000')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read"  ON app_settings;
DROP POLICY IF EXISTS "admin write"  ON app_settings;
CREATE POLICY "public read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "admin write" ON app_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- 5. Verify contact_unlocks has expires_at
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'contact_unlocks'
ORDER BY ordinal_position;
