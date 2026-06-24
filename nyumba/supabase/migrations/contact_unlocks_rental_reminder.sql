-- NyumbaFasta — contact_unlocks: add rental reminder tracking
-- Run in Supabase SQL Editor

-- ── 1. Add reminder_sent_at column ───────────────────────────────────────────
ALTER TABLE contact_unlocks
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- ── 2. Index for efficient cron query ────────────────────────────────────────
-- Finds completed unlocks older than 24h that haven't been reminded yet.
-- Partial index is small and fast.
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_reminder
  ON contact_unlocks (created_at)
  WHERE reminder_sent_at IS NULL AND status = 'completed';

-- ── 3. Verify ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contact_unlocks'
ORDER BY ordinal_position;
