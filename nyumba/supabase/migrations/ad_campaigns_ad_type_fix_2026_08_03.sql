-- ════════════════════════════════════════════════════════════════════════
-- Fix ad_campaigns.ad_type CHECK constraint
-- The ads_bundle_migration expanded ad_subscription_plans to allow 'bundle'
-- and 'directory', but ad_campaigns was not updated — causing insert failures
-- when advertisers create campaigns using those plan types.
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_ad_type_check;

ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_ad_type_check
  CHECK (ad_type IN ('banner', 'search', 'nearby', 'video', 'featured', 'bundle', 'directory'));

-- Also keep ad_waiting_list in sync
ALTER TABLE ad_waiting_list DROP CONSTRAINT IF EXISTS ad_waiting_list_ad_type_check;

ALTER TABLE ad_waiting_list ADD CONSTRAINT ad_waiting_list_ad_type_check
  CHECK (ad_type IN ('banner', 'search', 'nearby', 'video', 'featured', 'bundle', 'directory'));
