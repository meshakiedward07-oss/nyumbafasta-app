-- Add missing columns to agent_leads for Excel/CSV bulk import and CRM
-- Run once in Supabase SQL Editor
-- Date: 2026-07-11

-- ── 1. Add missing contact + social + location columns ───────────────────────
ALTER TABLE agent_leads
  ADD COLUMN IF NOT EXISTS whatsapp       TEXT,
  ADD COLUMN IF NOT EXISTS notes          TEXT,
  ADD COLUMN IF NOT EXISTS district       TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url   TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url  TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url     TEXT,
  ADD COLUMN IF NOT EXISTS website_url    TEXT;

-- ── 2. Add excel_import to the source CHECK constraint ───────────────────────
ALTER TABLE agent_leads DROP CONSTRAINT IF EXISTS agent_leads_source_check;
ALTER TABLE agent_leads
  ADD CONSTRAINT agent_leads_source_check
  CHECK (source IN (
    'google_maps', 'google_business', 'facebook_groups', 'facebook_pages',
    'facebook_profile', 'instagram', 'tiktok', 'manual', 'excel_import',
    'whatsapp_amina', 'instagram_amina', 'facebook_amina'
  ));

-- ── 3. Indexes for social URL dedup lookups ───────────────────────────────────
CREATE INDEX IF NOT EXISTS agent_leads_facebook_url_idx   ON agent_leads (facebook_url)   WHERE facebook_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_leads_instagram_url_idx  ON agent_leads (instagram_url)  WHERE instagram_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_leads_tiktok_url_idx     ON agent_leads (tiktok_url)     WHERE tiktok_url IS NOT NULL;
