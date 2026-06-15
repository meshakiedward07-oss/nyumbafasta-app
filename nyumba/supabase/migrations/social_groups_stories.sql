-- ── Facebook Posting Groups + Instagram Stories ───────────────────────────────
-- Run in Supabase SQL Editor
-- NOTE: facebook_groups table already exists for Lead Hunting (scraping).
--       fb_posting_groups is a SEPARATE table for auto-posting listings to groups.

-- 1. Groups registry for posting listings (separate from Lead Hunting facebook_groups)
CREATE TABLE IF NOT EXISTS fb_posting_groups (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        TEXT        UNIQUE NOT NULL,   -- Facebook Group numeric ID
  group_name      TEXT        NOT NULL,
  group_url       TEXT,
  members_count   INTEGER,
  category        TEXT        DEFAULT 'nyumba',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  post_count      INTEGER     NOT NULL DEFAULT 0,
  last_posted_at  TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. History of posts sent to groups
CREATE TABLE IF NOT EXISTS facebook_group_posts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    UUID        REFERENCES listings(id) ON DELETE SET NULL,
  group_id      TEXT        NOT NULL,
  group_name    TEXT        NOT NULL,
  post_id       TEXT,
  message       TEXT        NOT NULL,
  image_url     TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','posted','failed','skipped')),
  error_message TEXT,
  posted_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Instagram Stories history
CREATE TABLE IF NOT EXISTS instagram_stories (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    UUID        REFERENCES listings(id) ON DELETE SET NULL,
  story_type    TEXT        NOT NULL DEFAULT 'listing'
                            CHECK (story_type IN ('listing','promotion','announcement')),
  media_url     TEXT        NOT NULL,
  story_id      TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','posted','failed','expired')),
  error_message TEXT,
  expires_at    TIMESTAMPTZ,
  posted_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fpg_active       ON fb_posting_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_fpg_last_posted  ON fb_posting_groups(last_posted_at);
CREATE INDEX IF NOT EXISTS idx_fgp_listing      ON facebook_group_posts(listing_id);
CREATE INDEX IF NOT EXISTS idx_fgp_status       ON facebook_group_posts(status);
CREATE INDEX IF NOT EXISTS idx_fgp_group        ON facebook_group_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_fgp_created      ON facebook_group_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_is_listing       ON instagram_stories(listing_id);
CREATE INDEX IF NOT EXISTS idx_is_status        ON instagram_stories(status);
CREATE INDEX IF NOT EXISTS idx_is_created       ON instagram_stories(created_at DESC);

-- Disable RLS (admin-only, service role)
ALTER TABLE fb_posting_groups    DISABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_group_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_stories    DISABLE ROW LEVEL SECURITY;
