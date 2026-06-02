-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: payment_method enum → TEXT
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: angalia aina ya column kabla ya kubadilisha
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE column_name = 'payment_method'
  AND table_schema = 'public';

-- Step 2: badilisha contact_unlocks.payment_method kuwa TEXT
ALTER TABLE contact_unlocks
  ALTER COLUMN payment_method TYPE TEXT;

-- Step 3: badilisha subscriptions.payment_method kuwa TEXT
ALTER TABLE subscriptions
  ALTER COLUMN payment_method TYPE TEXT;

-- Step 4: badilisha boost_payments.payment_method kuwa TEXT (kama ipo)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boost_payments'
      AND column_name = 'payment_method'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE boost_payments ALTER COLUMN payment_method TYPE TEXT;
  END IF;
END $$;

-- Step 5: angalia kama enum type ipo na iifute
DO $$
DECLARE
  enum_name TEXT;
BEGIN
  -- Tafuta enum yenye payment_method-related name
  FOR enum_name IN
    SELECT typname FROM pg_type
    WHERE typtype = 'e'
      AND typname ILIKE '%payment%'
  LOOP
    RAISE NOTICE 'Found enum: %', enum_name;
    -- Haitaweza kufutwa hadi hakuna column inayoitumia
    -- Columns zimebadilishwa kuwa TEXT hapo juu, kwa hivyo inaweza kufutwa
    EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', enum_name);
    RAISE NOTICE 'Dropped enum: %', enum_name;
  END LOOP;
END $$;

-- Step 6: thibitisha mabadiliko
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name = 'payment_method'
  AND table_schema = 'public';
