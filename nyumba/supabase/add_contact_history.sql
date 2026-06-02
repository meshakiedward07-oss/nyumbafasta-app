-- Contact History Feature — run this in Supabase SQL Editor
-- Inaongeza columns mpya kwenye contact_unlocks table

ALTER TABLE contact_unlocks
  ADD COLUMN IF NOT EXISTS payment_method     TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref        TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid        INTEGER,
  ADD COLUMN IF NOT EXISTS client_notes       TEXT,
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interaction_count  INTEGER NOT NULL DEFAULT 1;

-- Backfill amount_paid kutoka amount (kama ipo)
UPDATE contact_unlocks
SET amount_paid = amount
WHERE amount_paid IS NULL AND amount IS NOT NULL;

-- Backfill payment_ref kutoka order_id (kama ipo)
UPDATE contact_unlocks
SET payment_ref = order_id
WHERE payment_ref IS NULL AND order_id IS NOT NULL;
