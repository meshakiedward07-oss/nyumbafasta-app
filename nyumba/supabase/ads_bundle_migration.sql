-- ════════════════════════════════════════════════════════════════
-- ads_bundle_migration.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Adds bundle_types and visibility to ad_subscription_plans so admin
-- can create subscription plans that combine multiple ad types and
-- control where each plan is displayed to advertisers.
-- ════════════════════════════════════════════════════════════════

-- 1. Drop the restrictive CHECK on ad_type so admin can categorise
--    bundle plans with 'bundle' or 'directory' as the primary type.
ALTER TABLE public.ad_subscription_plans
  DROP CONSTRAINT IF EXISTS ad_subscription_plans_ad_type_check;

ALTER TABLE public.ad_subscription_plans
  ADD CONSTRAINT ad_subscription_plans_ad_type_check
  CHECK (ad_type IN ('banner','search','nearby','video','featured','bundle','directory'));

-- 2. Add bundle_types — JSONB array of ad types included in this plan
--    e.g. ["featured","nearby"]
ALTER TABLE public.ad_subscription_plans
  ADD COLUMN IF NOT EXISTS bundle_types JSONB NOT NULL DEFAULT '[]';

-- 3. Add visibility — controls where the plan is shown to advertisers
--    'new_campaign'  → shows in /advertising/new (plan picker)
--    'featured_only' → shows only on Featured/Directory upgrade page
--    'dashboard'     → shows in advertiser dashboard upsell section
--    'all'           → visible everywhere
ALTER TABLE public.ad_subscription_plans
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'new_campaign'
  CHECK (visibility IN ('new_campaign','featured_only','dashboard','all'));

-- 4. Add placements if it does not already exist
ALTER TABLE public.ad_subscription_plans
  ADD COLUMN IF NOT EXISTS placements JSONB NOT NULL DEFAULT '[]';

-- 5. Backfill bundle_types from existing plans (ad_type → bundle_types[0])
UPDATE public.ad_subscription_plans
SET bundle_types = jsonb_build_array(ad_type)
WHERE bundle_types = '[]'::jsonb;

-- 6. Backfill placements from ad_type for older rows
UPDATE public.ad_subscription_plans
SET placements = jsonb_build_array(ad_type)
WHERE placements = '[]'::jsonb;

-- Verify
SELECT id, name, ad_type, bundle_types, visibility, placements
FROM public.ad_subscription_plans
ORDER BY display_order;
