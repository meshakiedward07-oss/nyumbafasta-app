-- Ads system coordination indexes
-- Run in Supabase SQL Editor (each statement individually if CONCURRENTLY causes issues)

-- Speed up campaign lookups by plan (used in payment processing + slot checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_plan_id
  ON ad_campaigns (plan_id);

-- Speed up advertiser auth lookups by user_id + status (requireAdvertiserAuth hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_advertisers_user_id_status
  ON advertisers (user_id, status);

-- Speed up campaign queries by advertiser + status (dashboard + admin list)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_advertiser_status
  ON ad_campaigns (advertiser_id, status);

-- Speed up payment lookups by external_id (webhook hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_payments_external_id
  ON ad_payments (external_id);

-- Speed up active campaign queries by region + type (slot availability check)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_region_type_status
  ON ad_campaigns (target_region, ad_type, status);

-- Speed up waiting list deduplication check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_waiting_list_advertiser_type_region
  ON ad_waiting_list (advertiser_id, ad_type, region);
