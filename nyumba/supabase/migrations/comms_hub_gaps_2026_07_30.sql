-- ── Communication Hub Gaps — 2026-07-30 ────────────────────────────────────
-- Run this migration manually in the Supabase SQL editor.
-- Adds columns needed by the new communication hub features.

-- 1. WhatsApp Sessions: store the customer's WhatsApp profile name
ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS profile_name TEXT;

-- 2. Social Comments: track who replied and when (manual admin replies)
ALTER TABLE social_comments
  ADD COLUMN IF NOT EXISTS replied_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_by  UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. WhatsApp Broadcasts: support scheduled sends
ALTER TABLE whatsapp_broadcasts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Update the status check constraint to allow 'scheduled' status
-- (safe to run multiple times — ALTER CONSTRAINT is idempotent via DROP + ADD)
ALTER TABLE whatsapp_broadcasts
  DROP CONSTRAINT IF EXISTS whatsapp_broadcasts_status_check;

ALTER TABLE whatsapp_broadcasts
  ADD CONSTRAINT whatsapp_broadcasts_status_check
    CHECK (status IN ('sending','completed','failed','scheduled'));

-- Index for querying scheduled broadcasts (e.g. a cron job picking up due broadcasts)
CREATE INDEX IF NOT EXISTS idx_whatsapp_broadcasts_scheduled
  ON whatsapp_broadcasts(scheduled_at)
  WHERE status = 'scheduled';
