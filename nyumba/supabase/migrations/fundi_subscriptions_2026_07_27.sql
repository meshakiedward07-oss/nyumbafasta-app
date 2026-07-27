-- ============================================================
-- Fundi/Vendor Subscription System
-- Admin-managed plans + fundi payment records
-- Also expands income_records.source to include 'fundi_subscription'
-- Run in Supabase SQL Editor — 2026-07-27
-- ============================================================

-- ── 1. Admin-managed fundi subscription plans ────────────────────────────
CREATE TABLE IF NOT EXISTS fundi_subscription_plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  price_tzs     INTEGER     NOT NULL CHECK (price_tzs >= 0),
  billing_cycle TEXT        NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  max_job_forms INTEGER     NOT NULL DEFAULT 10,
  features      JSONB       NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  is_default    BOOLEAN     NOT NULL DEFAULT false,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one plan can be the default
CREATE UNIQUE INDEX IF NOT EXISTS uidx_fundi_plans_default
  ON fundi_subscription_plans (is_default)
  WHERE is_default = true;

-- ── 2. Fundi subscription records ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fundi_subscriptions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fundi_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id        UUID        NOT NULL REFERENCES fundi_subscription_plans(id),
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'active', 'expired', 'failed', 'cancelled')),
  payment_ref    TEXT        UNIQUE,
  amount_paid    INTEGER,
  payment_method TEXT,
  starts_at      TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fundi_subs_user   ON fundi_subscriptions (fundi_user_id, status);
CREATE INDEX IF NOT EXISTS idx_fundi_subs_ref     ON fundi_subscriptions (payment_ref);
CREATE INDEX IF NOT EXISTS idx_fundi_subs_expires ON fundi_subscriptions (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_fundi_plans_active ON fundi_subscription_plans (is_active, display_order);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_fundi_plans()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_fundi_plans_updated_at ON fundi_subscription_plans;
CREATE TRIGGER trg_fundi_plans_updated_at
  BEFORE UPDATE ON fundi_subscription_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_fundi_plans();

CREATE OR REPLACE FUNCTION set_updated_at_fundi_subs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_fundi_subs_updated_at ON fundi_subscriptions;
CREATE TRIGGER trg_fundi_subs_updated_at
  BEFORE UPDATE ON fundi_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_fundi_subs();

-- ── 3. RLS on fundi_subscription_plans ───────────────────────────────────
ALTER TABLE fundi_subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read active plans (fundi needs to see them to subscribe)
CREATE POLICY "fundi_plans_public_read" ON fundi_subscription_plans
  FOR SELECT USING (is_active = true);

-- Admins/staff can read all (including inactive)
CREATE POLICY "fundi_plans_admin_all" ON fundi_subscription_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'staff')
    )
  );

-- ── 4. RLS on fundi_subscriptions ────────────────────────────────────────
ALTER TABLE fundi_subscriptions ENABLE ROW LEVEL SECURITY;

-- Fundi can see their own
CREATE POLICY "fundi_subs_own" ON fundi_subscriptions
  FOR SELECT USING (fundi_user_id = auth.uid());

-- Admins/staff can see all
CREATE POLICY "fundi_subs_admin_all" ON fundi_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'staff')
    )
  );

-- ── 5. Seed one default plan ──────────────────────────────────────────────
INSERT INTO fundi_subscription_plans
  (name, description, price_tzs, billing_cycle, max_job_forms, is_active, is_default, display_order)
VALUES
  ('Basic', 'Jibu maombi ya kazi kupitia NyumbaFasta — hadi fomu 10 kwa mwezi', 5000, 'monthly', 10, true, true, 1),
  ('Pro',   'Jibu maombi bila kikomo na pata umuhimu wa juu kwa wateja', 15000, 'monthly', 999, true, false, 2)
ON CONFLICT DO NOTHING;

-- ── 6. Expand income_records.source CHECK ────────────────────────────────
ALTER TABLE income_records
  DROP CONSTRAINT IF EXISTS income_records_source_check;

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
    'fundi_subscription',
    'other'
  ));

-- Index for per-source reports
CREATE INDEX IF NOT EXISTS idx_inc_src_date
  ON income_records (source, transaction_date DESC);
