-- ── Dalali Finance Tables ────────────────────────────────────────────────────
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. INCOME
CREATE TABLE IF NOT EXISTS dalali_income (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL,
  category       TEXT    NOT NULL,
  date           DATE    NOT NULL DEFAULT CURRENT_DATE,
  description    TEXT,
  client_name    TEXT,
  listing_title  TEXT,
  payment_method TEXT    DEFAULT 'cash',
  is_paid        BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_di_dalali_date ON dalali_income(dalali_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_di_category    ON dalali_income(dalali_id, category);

-- 2. EXPENSES
CREATE TABLE IF NOT EXISTS dalali_expenses (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL,
  category       TEXT    NOT NULL,
  date           DATE    NOT NULL DEFAULT CURRENT_DATE,
  description    TEXT,
  payment_method TEXT    DEFAULT 'cash',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_de_dalali_date ON dalali_expenses(dalali_id, date DESC);

-- 3. COMMISSIONS
CREATE TABLE IF NOT EXISTS dalali_commissions (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id        UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name      TEXT    NOT NULL,
  property_title   TEXT    NOT NULL,
  expected_amount  INTEGER NOT NULL,
  paid_amount      INTEGER DEFAULT 0,
  due_date         DATE,
  paid_date        DATE,
  status           TEXT    DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dc_dalali_status ON dalali_commissions(dalali_id, status);
CREATE INDEX IF NOT EXISTS idx_dc_due          ON dalali_commissions(dalali_id, due_date);

-- 4. GOALS
CREATE TABLE IF NOT EXISTS dalali_goals (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id      UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT    NOT NULL,
  target_amount  INTEGER NOT NULL,
  current_amount INTEGER DEFAULT 0,
  month          INTEGER NOT NULL,
  year           INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dalali_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_dg_dalali_period ON dalali_goals(dalali_id, year, month);

-- RLS
ALTER TABLE dalali_income      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalali_expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalali_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dalali_goals       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Own income only"
    ON dalali_income FOR ALL TO authenticated
    USING (dalali_id = auth.uid()) WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Own expenses only"
    ON dalali_expenses FOR ALL TO authenticated
    USING (dalali_id = auth.uid()) WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Own commissions only"
    ON dalali_commissions FOR ALL TO authenticated
    USING (dalali_id = auth.uid()) WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Own goals only"
    ON dalali_goals FOR ALL TO authenticated
    USING (dalali_id = auth.uid()) WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service full access income"
    ON dalali_income TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service full access expenses"
    ON dalali_expenses TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service full access commissions"
    ON dalali_commissions TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service full access goals"
    ON dalali_goals TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auto-update commission status trigger
CREATE OR REPLACE FUNCTION update_commission_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.paid_amount >= NEW.expected_amount THEN
    NEW.status = 'paid'; NEW.paid_date = CURRENT_DATE;
  ELSIF NEW.paid_amount > 0 THEN
    NEW.status = 'partial';
  ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND NEW.paid_amount = 0 THEN
    NEW.status = 'overdue';
  ELSE
    NEW.status = 'pending';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commission_status ON dalali_commissions;
CREATE TRIGGER trg_commission_status
  BEFORE INSERT OR UPDATE ON dalali_commissions
  FOR EACH ROW EXECUTE FUNCTION update_commission_status();

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('dalali_income','dalali_expenses','dalali_commissions','dalali_goals')
ORDER BY table_name;
