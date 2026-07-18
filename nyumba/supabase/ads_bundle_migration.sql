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

-- 4. Add placements if it does not already exist.
--    If the column already exists as text[], this is a no-op (IF NOT EXISTS).
--    We keep it as text[] to match existing rows; bundle_types is JSONB.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'ad_subscription_plans'
      AND column_name  = 'placements'
  ) THEN
    ALTER TABLE public.ad_subscription_plans
      ADD COLUMN placements TEXT[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- 5. Backfill bundle_types (JSONB) from existing plans
UPDATE public.ad_subscription_plans
SET bundle_types = jsonb_build_array(ad_type)
WHERE bundle_types = '[]'::jsonb;

-- 6. Backfill placements (text[]) from ad_type for rows that have no placements yet.
--    Works whether the column is TEXT[] (old) or was just created above.
UPDATE public.ad_subscription_plans
SET placements = ARRAY[ad_type]
WHERE placements IS NULL OR array_length(placements, 1) IS NULL OR placements = '{}';

-- Verify
SELECT id, name, ad_type, bundle_types, visibility, placements
FROM public.ad_subscription_plans
ORDER BY display_order;
