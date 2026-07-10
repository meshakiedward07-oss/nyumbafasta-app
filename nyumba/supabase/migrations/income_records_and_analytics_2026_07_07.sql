-- ═══════════════════════════════════════════════════════════════
-- NyumbaFasta — Income records + financial summaries tables
-- Date: 2026-07-07  |  Safe to re-run (idempotent)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ── 1. income_records ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_records (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT         NOT NULL
                     CHECK (source IN ('subscription','contact_unlock','boost_listing','extra_listing','other')),
  source_ref_id    UUID,
  dalali_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
  listing_id       UUID         REFERENCES listings(id) ON DELETE SET NULL,
  amount_tzs       DECIMAL(12,2) NOT NULL,
  platform_fee_tzs DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount_tzs   DECIMAL(12,2) NOT NULL,
  description      TEXT,
  reference_number TEXT,
  payment_method   TEXT,
  transaction_date DATE         NOT NULL,
  month            INTEGER      NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INTEGER      NOT NULL,
  week             INTEGER,
  status           TEXT         NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','pending','refunded')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE income_records ADD COLUMN IF NOT EXISTS source_ref_id    UUID;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS dalali_id        UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS listing_id       UUID REFERENCES listings(id) ON DELETE SET NULL;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS platform_fee_tzs DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS net_amount_tzs   DECIMAL(12,2);
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS payment_method   TEXT;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS week             INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_source_ref
  ON income_records (source, source_ref_id)
  WHERE source_ref_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_date  ON income_records (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_income_month ON income_records (year, month);
CREATE INDEX IF NOT EXISTS idx_income_src   ON income_records (source);

ALTER TABLE income_records DISABLE ROW LEVEL SECURITY;

-- ── 2. expense_records ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_records (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT         NOT NULL,
  subcategory      TEXT,
  vendor           TEXT,
  description      TEXT,
  amount_tzs       DECIMAL(12,2) NOT NULL,
  payment_method   TEXT,
  reference_number TEXT,
  receipt_url      TEXT,
  transaction_date DATE         NOT NULL,
  month            INTEGER      NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INTEGER      NOT NULL,
  week             INTEGER,
  is_recurring     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_date  ON expense_records (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_month ON expense_records (year, month);
CREATE INDEX IF NOT EXISTS idx_expense_cat   ON expense_records (category);

ALTER TABLE expense_records DISABLE ROW LEVEL SECURITY;

-- ── 3. financial_summaries (monthly rollup) ──────────────────────
CREATE TABLE IF NOT EXISTS financial_summaries (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  year                    INTEGER      NOT NULL,
  month                   INTEGER      NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_income_tzs        DECIMAL(15,2) DEFAULT 0,
  subscription_income     DECIMAL(15,2) DEFAULT 0,
  contact_unlock_income   DECIMAL(15,2) DEFAULT 0,
  boost_listing_income    DECIMAL(15,2) DEFAULT 0,
  extra_listing_income    DECIMAL(15,2) DEFAULT 0,
  other_income            DECIMAL(15,2) DEFAULT 0,
  total_expenses_tzs      DECIMAL(15,2) DEFAULT 0,
  platform_fees_tzs       DECIMAL(15,2) DEFAULT 0,
  net_profit_tzs          DECIMAL(15,2) DEFAULT 0,
  new_subscriptions       INTEGER       DEFAULT 0,
  churned_subscriptions   INTEGER       DEFAULT 0,
  active_subscriptions    INTEGER       DEFAULT 0,
  total_unlocks           INTEGER       DEFAULT 0,
  total_boosts            INTEGER       DEFAULT 0,
  income_growth_percent   DECIMAL(5,2),
  created_at              TIMESTAMPTZ   DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (year, month)
);

ALTER TABLE financial_summaries DISABLE ROW LEVEL SECURITY;

-- ── 4. recurring_expenses (fixed monthly costs) ──────────────────
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT         NOT NULL,
  subcategory  TEXT,
  vendor       TEXT,
  description  TEXT         NOT NULL,
  amount_tzs   DECIMAL(12,2) NOT NULL,
  frequency    TEXT         NOT NULL DEFAULT 'monthly'
                 CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  day_of_month INTEGER,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed default recurring expenses (safe to re-run)
INSERT INTO recurring_expenses (category, subcategory, vendor, description, amount_tzs, frequency, day_of_month) VALUES
  ('hosting',   'database',  'Supabase',  'Supabase Database (Pro)',              26000, 'monthly', 1),
  ('hosting',   'frontend',  'Vercel',    'Vercel Pro Plan',                      26000, 'monthly', 1),
  ('hosting',   'whatsapp',  'Fly.io',    'WhatsApp service (Fly.io)',            13000, 'monthly', 1),
  ('hosting',   'ai',        'Anthropic', 'Claude AI API',                        26000, 'monthly', 1),
  ('marketing', 'sms',       'Beem',      'SMS notifications (Beem Africa)',       5000, 'monthly', 1)
ON CONFLICT DO NOTHING;

ALTER TABLE recurring_expenses DISABLE ROW LEVEL SECURITY;

-- ── 5. Verify ────────────────────────────────────────────────────
SELECT 'income_records'      AS tbl, COUNT(*) FROM income_records
UNION ALL
SELECT 'expense_records'     AS tbl, COUNT(*) FROM expense_records
UNION ALL
SELECT 'financial_summaries' AS tbl, COUNT(*) FROM financial_summaries
UNION ALL
SELECT 'recurring_expenses'  AS tbl, COUNT(*) FROM recurring_expenses;
