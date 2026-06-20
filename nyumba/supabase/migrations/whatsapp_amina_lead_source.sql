-- Add Amina WhatsApp/social lead sources to agent_leads
-- Run in Supabase SQL Editor
-- Date: 2026-06-20
-- Adds 'whatsapp_amina', 'instagram_amina', 'facebook_amina' as valid source values

-- Drop the old restrictive CHECK constraint (if it still exists)
ALTER TABLE agent_leads DROP CONSTRAINT IF EXISTS agent_leads_source_check;

-- Re-add with all current + new source values
ALTER TABLE agent_leads
  ADD CONSTRAINT agent_leads_source_check
  CHECK (source IN (
    'google_maps',
    'google_business',
    'facebook_groups',
    'facebook_pages',
    'facebook_profile',
    'instagram',
    'tiktok',
    'manual',
    'whatsapp_amina',
    'instagram_amina',
    'facebook_amina'
  ));

-- Index to speed up filtering Amina-captured leads in CRM
CREATE INDEX IF NOT EXISTS agent_leads_amina_source_idx
  ON agent_leads (source)
  WHERE source IN ('whatsapp_amina', 'instagram_amina', 'facebook_amina');
