-- Ads system coordination indexes
-- Run in Supabase SQL Editor (paste all at once)

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_plan_id
  ON ad_campaigns (plan_id);

CREATE INDEX IF NOT EXISTS idx_advertisers_user_id_status
  ON advertisers (user_id, status);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser_status
  ON ad_campaigns (advertiser_id, status);

CREATE INDEX IF NOT EXISTS idx_ad_payments_external_id
  ON ad_payments (external_id);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_region_type_status
  ON ad_campaigns (target_region, ad_type, status);

CREATE INDEX IF NOT EXISTS idx_ad_waiting_list_advertiser_type_region
  ON ad_waiting_list (advertiser_id, ad_type, region);
