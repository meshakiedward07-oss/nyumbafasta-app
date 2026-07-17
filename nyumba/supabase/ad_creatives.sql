-- ═══════════════════════════════════════════════════════════════════════════════
-- Ad Creatives + Bundle Placements migration
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. ad_creatives table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_creatives (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id     uuid        NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  campaign_id       uuid        REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  media_type        text        NOT NULL CHECK (media_type IN ('image', 'video', 'carousel')),
  original_url      text        NOT NULL,
  -- Auto-generated landscape variants (all in Supabase Storage bucket "listings")
  banner_url        text,        -- 1200×400 (3:1)
  search_url        text,        -- 600×200  (3:1)
  nearby_url        text,        -- 300×200  (3:2)
  featured_url      text,        -- 800×450  (16:9)
  video_thumb_url   text,        -- 640×360  (16:9) — still image thumbnail
  -- Video-specific (stored on Cloudinary)
  video_url         text,
  -- Carousel: array of banner-size variant URLs (one per slide)
  carousel_urls     text[],
  processing_status text        NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign  ON ad_creatives (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_advertiser ON ad_creatives (advertiser_id, created_at DESC);

-- ── 2. Add placements column to subscription plans ──────────────────────────
ALTER TABLE ad_subscription_plans
  ADD COLUMN IF NOT EXISTS placements text[] NOT NULL DEFAULT '{}';

-- Set sensible defaults for existing plans (each plan type → its own placement)
UPDATE ad_subscription_plans
SET placements = ARRAY[ad_type]
WHERE array_length(placements, 1) IS NULL OR placements = '{}';

-- ── 3. Add allowed_placements + creative_id to campaigns ────────────────────
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS allowed_placements text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES ad_creatives(id) ON DELETE SET NULL;

-- Backfill existing campaigns from their plan's placements
UPDATE ad_campaigns c
SET allowed_placements = p.placements
FROM ad_subscription_plans p
WHERE c.plan_id = p.id
  AND (array_length(c.allowed_placements, 1) IS NULL OR c.allowed_placements = '{}');

-- Index for placement-based ranking queries: campaigns @> ['banner'] etc.
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_placements
  ON ad_campaigns USING gin (allowed_placements);

-- ── NOTE ─────────────────────────────────────────────────────────────────────
-- Ad creative images are stored in the existing "listings" Supabase Storage
-- bucket under folder "ad-creatives/{advertiser_id}/{creative_id}/".
-- No new bucket is needed.
-- Videos are uploaded to Cloudinary (already configured) under folder
-- "ad-creatives/{advertiser_id}/".
