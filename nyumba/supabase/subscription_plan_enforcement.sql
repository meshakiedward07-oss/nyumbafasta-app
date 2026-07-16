-- Subscription plan enforcement — run in Supabase SQL editor.
--
-- is_sub_suspended: set TRUE on listings beyond free-plan limit (2) when subscription
-- expires. Set FALSE again when subscription is renewed. Does NOT touch listing
-- status so the dalali's own dashboard still shows all their listings.
--
-- extra_listings_expires_at: tracks when extra listing slots purchased via the
-- payments flow expire (30 days from purchase). Cron resets extra_listings = 0
-- when this timestamp passes.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS is_sub_suspended BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS extra_listings_expires_at TIMESTAMPTZ;

-- Fast filter for public listing queries
CREATE INDEX IF NOT EXISTS idx_listings_sub_suspended
  ON listings(dalali_id, is_sub_suspended)
  WHERE is_sub_suspended = FALSE;

-- Fast lookup for extra-listings expiry cron
CREATE INDEX IF NOT EXISTS idx_subscriptions_extra_expires
  ON subscriptions(extra_listings_expires_at)
  WHERE extra_listings_expires_at IS NOT NULL;
