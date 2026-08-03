-- ════════════════════════════════════════════════════════════════════════
-- Payments Schema Fixes — Add upgrade/downgrade/fundi types + metadata column
-- Run in the Supabase SQL editor BEFORE deploying to production.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Expand the payments.type CHECK constraint.
--    The original constraint only allowed unlock/subscription/extra_listings/boost.
--    'upgrade' and 'fundi_subscription' inserts were crashing at DB level.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_type_check
  CHECK (type IN (
    'unlock', 'subscription', 'extra_listings', 'boost',
    'upgrade', 'downgrade', 'fundi_subscription'
  ));

-- 2. Add metadata JSONB column to store extra payment-specific data.
--    Used by upgrade payments to carry to_plan + from_plan into the webhook.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Add pending_plan column to subscriptions for scheduled downgrades.
--    When a dalali requests a downgrade, we store the target plan here;
--    the daily cron applies it at period end.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pending_plan TEXT
  CHECK (pending_plan IN ('free', 'basic', 'premium', 'enterprise'));

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pending_plan_at TIMESTAMPTZ;
