-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions Phase 1 — Plans + Organization Subscriptions
-- Run AFTER property_management_phase1.sql (depends on organizations table)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Add billing + deactivation fields to organizations ────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_name    text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_phone   text,
  ADD COLUMN IF NOT EXISTS billing_email   text,
  ADD COLUMN IF NOT EXISTS tax_id          text,
  ADD COLUMN IF NOT EXISTS deactivated_at  timestamptz;

-- ── 2. Subscription Plans (admin-editable; no hardcoded logic) ───────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  description   text,
  price_tzs     integer     NOT NULL DEFAULT 0 CHECK (price_tzs >= 0),
  billing_cycle text        NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  is_active     boolean     NOT NULL DEFAULT true,
  is_public     boolean     NOT NULL DEFAULT true,
  is_default    boolean     NOT NULL DEFAULT false,
  -- Structured feature limits — every key is explicit, no paragraph blobs
  features      jsonb       NOT NULL DEFAULT '{
    "max_properties": 2,
    "max_units": 5,
    "max_members": 1,
    "has_reports": false,
    "has_maintenance": true,
    "has_communication_hub": true,
    "has_vendor_directory": false,
    "has_staff_assisted_listing": false,
    "has_priority_support": false,
    "trial_days": 14
  }',
  created_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Enforce exactly one default plan
CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_one_default
  ON subscription_plans(is_default) WHERE is_default = true;

-- ── 3. Organization Subscriptions (one per org, always) ─────────────────────
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid        NOT NULL UNIQUE
                                     REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                uuid        REFERENCES subscription_plans(id) ON DELETE SET NULL,
  status                 text        NOT NULL DEFAULT 'trial'
                                     CHECK (status IN (
                                       'trial', 'active', 'past_due',
                                       'grace_period', 'cancelled', 'expired'
                                     )),
  trial_ends_at          timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  -- Scheduled downgrade: goes live at end of current period
  pending_plan_id        uuid        REFERENCES subscription_plans(id) ON DELETE SET NULL,
  pending_plan_starts_at timestamptz,
  cancelled_at           timestamptz,
  cancellation_reason    text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_subscriptions_org_id_idx
  ON organization_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS organization_subscriptions_status_idx
  ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS organization_subscriptions_period_end_idx
  ON organization_subscriptions(current_period_end);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE subscription_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- subscription_plans: public read (portal needs plan info); write = admin/staff only
DROP POLICY IF EXISTS "subscription_plans_read"  ON subscription_plans;
DROP POLICY IF EXISTS "subscription_plans_write" ON subscription_plans;

CREATE POLICY "subscription_plans_read" ON subscription_plans
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "subscription_plans_write" ON subscription_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
    )
  );

-- organization_subscriptions: org members + admin/staff
DROP POLICY IF EXISTS "org_subscriptions_member_read"  ON organization_subscriptions;
DROP POLICY IF EXISTS "org_subscriptions_admin_write"  ON organization_subscriptions;

CREATE POLICY "org_subscriptions_member_read" ON organization_subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "org_subscriptions_admin_write" ON organization_subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
    )
  );

-- ── 5. Seed data — free tier + one paid plan ─────────────────────────────────
-- Free tier (is_default = true → auto-assigned on org creation)
INSERT INTO subscription_plans (
  name, description, price_tzs, billing_cycle, is_default, is_public, features
) VALUES (
  'Msingi',
  'Kwa wamiliki wadogo wenye mali 1–2. Bila malipo.',
  0,
  'monthly',
  true,
  true,
  '{
    "max_properties": 2,
    "max_units": 5,
    "max_members": 2,
    "has_reports": false,
    "has_maintenance": true,
    "has_communication_hub": true,
    "has_vendor_directory": false,
    "has_staff_assisted_listing": false,
    "has_priority_support": false,
    "trial_days": 14
  }'
) ON CONFLICT DO NOTHING;

-- Paid plan (Kamili — full access)
INSERT INTO subscription_plans (
  name, description, price_tzs, billing_cycle, is_default, is_public, features
) VALUES (
  'Kamili',
  'Kwa wasimamizi wa mali na makampuni. Mali zisizo na kikomo, ripoti kamili, na msaada wa kipaumbele.',
  50000,
  'monthly',
  false,
  true,
  '{
    "max_properties": -1,
    "max_units": -1,
    "max_members": -1,
    "has_reports": true,
    "has_maintenance": true,
    "has_communication_hub": true,
    "has_vendor_directory": true,
    "has_staff_assisted_listing": true,
    "has_priority_support": true,
    "trial_days": 14
  }'
) ON CONFLICT DO NOTHING;
