"Badilisha sub_plan enum kuwa varchar(20) kwenye subscriptions table — enum inasababisha matatizo mengi. Pia badilisha TypeScript types zote zinazotumia sub_plan enum ziwe string type badala yake:
typescripttype SubscriptionPlan = 'basic' | 'premium' | 'enterprise'
// Badilisha siyo enum — ni union type ya string
Rekebisha na nionyeshe inafanya kazi"-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: subscriptions.plan enum → varchar(20)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: angalia aina ya sasa
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name = 'plan'
  AND table_schema = 'public';

-- Step 2: badilisha plan column kuwa varchar(20)
ALTER TABLE subscriptions
  ALTER COLUMN plan TYPE varchar(20);

-- Step 3: angalia kama kuna enum inayohusiana — iifute
DO $$
DECLARE
  e TEXT;
BEGIN
  FOR e IN
    SELECT typname FROM pg_type
    WHERE typtype = 'e'
      AND typname ILIKE '%plan%'
      AND typname ILIKE '%sub%'
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', e);
    RAISE NOTICE 'Dropped enum: %', e;
  END LOOP;
END $$;

-- Step 4: pia angalia check constraint — update ikubali enterprise pia
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('basic', 'premium', 'enterprise'));

-- Step 5: thibitisha
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'subscriptions'
  AND column_name = 'plan';
