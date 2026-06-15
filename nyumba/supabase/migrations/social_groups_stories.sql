-- ── Facebook Groups + Instagram Stories ──────────────────────────────────────
-- Run in Supabase SQL Editor

-- 1. Facebook Groups registry (groups to post to)
CREATE TABLE IF NOT EXISTS facebook_groups (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        TEXT        UNIQUE NOT NULL,
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

-- 2. Facebook Group post history
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
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id  UUID        REFERENCES listings(id) ON DELETE SET NULL,
  story_type  TEXT        NOT NULL DEFAULT 'listing'
                          CHECK (story_type IN ('listing','promotion','announcement')),
  media_url   TEXT        NOT NULL,
  story_id    TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','posted','failed','expired')),
  error_message TEXT,
  expires_at  TIMESTAMPTZ,
  posted_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fg_active       ON facebook_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_fg_last_posted  ON facebook_groups(last_posted_at);
CREATE INDEX IF NOT EXISTS idx_fgp_listing     ON facebook_group_posts(listing_id);
CREATE INDEX IF NOT EXISTS idx_fgp_status      ON facebook_group_posts(status);
CREATE INDEX IF NOT EXISTS idx_fgp_group       ON facebook_group_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_fgp_created     ON facebook_group_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_is_listing      ON instagram_stories(listing_id);
CREATE INDEX IF NOT EXISTS idx_is_status       ON instagram_stories(status);
CREATE INDEX IF NOT EXISTS idx_is_created      ON instagram_stories(created_at DESC);

-- Disable RLS (admin-only, service role)
ALTER TABLE facebook_groups      DISABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_group_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_stories    DISABLE ROW LEVEL SECURITY;

-- Seed placeholder groups (admin updates with real IDs from dashboard)
INSERT INTO facebook_groups (group_id, group_name, category, is_active, notes)
VALUES
  ('placeholder_1', 'Nyumba Tanzania - Ungeza Hapa', 'nyumba', false, 'Badilisha group_id na ID halisi kutoka Facebook'),
  ('placeholder_2', 'Real Estate Tanzania', 'real_estate', false, 'Badilisha group_id na ID halisi kutoka Facebook')
ON CONFLICT (group_id) DO NOTHING;
