-- ════════════════════════════════════════════════════════════════════════
-- Ad Creatives schema — idempotent (safe to run multiple times)
-- Creates ad_creatives table if it doesn't exist, and ensures all
-- required columns exist on ad_campaigns.
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. ad_creatives table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_creatives (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id     uuid        NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  campaign_id       uuid        REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  media_type        text        NOT NULL CHECK (media_type IN ('image', 'video', 'carousel')),
  original_url      text        NOT NULL,
  banner_url        text,
  search_url        text,
  nearby_url        text,
  featured_url      text,
  video_thumb_url   text,
  video_url         text,
  carousel_urls     text[],
  processing_status text        NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign   ON ad_creatives (campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_advertiser ON ad_creatives (advertiser_id, created_at DESC);

-- ── 2. Add placements column to subscription plans ──────────────────────────
ALTER TABLE ad_subscription_plans
  ADD COLUMN IF NOT EXISTS placements text[] NOT NULL DEFAULT '{}';

UPDATE ad_subscription_plans
SET placements = ARRAY[ad_type]
WHERE array_length(placements, 1) IS NULL OR placements = '{}';

-- ── 3. Add creative_id + video_url + allowed_placements to campaigns ─────────
ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS creative_id        uuid REFERENCES ad_creatives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_url          text,
  ADD COLUMN IF NOT EXISTS allowed_placements text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_placements
  ON ad_campaigns USING gin (allowed_placements);

-- Backfill existing campaigns from their plan's placements
UPDATE ad_campaigns c
SET allowed_placements = p.placements
FROM ad_subscription_plans p
WHERE c.plan_id = p.id
  AND (array_length(c.allowed_placements, 1) IS NULL OR c.allowed_placements = '{}');

-- ── 4. RLS policies for ad_creatives ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ad_creatives'
      AND policyname = 'ad_creatives_advertiser_all'
  ) THEN
    CREATE POLICY "ad_creatives_advertiser_all"
      ON ad_creatives FOR ALL
      USING (
        advertiser_id IN (
          SELECT id FROM advertisers WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
