-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 4-plan system (Free, Basic, Premium, Enterprise)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Badilisha plan column kuwa varchar(20) (kama si varchar tayari)
ALTER TABLE subscriptions
  ALTER COLUMN plan TYPE varchar(20)
  USING plan::text;

-- Step 2: Drop check constraint ya zamani na ongeza nyingine inayokubali plans zote 4
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'basic', 'premium', 'enterprise'));

-- Step 3: Weka free subscriptions kwa madalali wote wasio na subscription active
INSERT INTO subscriptions (
  dalali_id, plan, status,
  starts_at, expires_at, amount_paid
)
SELECT
  u.id,
  'free',
  'active',
  now(),
  '2099-12-31'::timestamptz,
  0
FROM public.users u
WHERE u.role = 'dalali'
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.dalali_id = u.id
      AND s.status = 'active'
  );

-- Step 4: Thibitisha
SELECT plan, COUNT(*) as count
FROM subscriptions
GROUP BY plan
ORDER BY count DESC;
