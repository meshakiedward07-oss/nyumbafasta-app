-- ── Social Media Automation System ───────────────────────────────────────────
-- Run this in the Supabase SQL editor

-- 1. Posts published to Instagram / Facebook
CREATE TABLE IF NOT EXISTS social_posts (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id           UUID        REFERENCES listings(id) ON DELETE SET NULL,
  platform             TEXT        NOT NULL CHECK (platform IN ('instagram', 'facebook', 'both')),
  media_type           TEXT        NOT NULL DEFAULT 'image'
                                   CHECK (media_type IN ('image', 'video', 'carousel', 'reel')),
  caption              TEXT        NOT NULL,
  hashtags             TEXT,
  instagram_post_id    TEXT,
  instagram_container_id TEXT,
  facebook_post_id     TEXT,
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  error_message        TEXT,
  scheduled_at         TIMESTAMPTZ,
  published_at         TIMESTAMPTZ,
  metrics              JSONB,      -- { likes, comments, reach, impressions, saved, video_views }
  metrics_updated_at   TIMESTAMPTZ,
  created_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Comments received on social posts
CREATE TABLE IF NOT EXISTS social_comments (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID    REFERENCES social_posts(id) ON DELETE SET NULL,
  platform        TEXT    NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  comment_id      TEXT    NOT NULL UNIQUE,        -- platform comment ID
  commenter_id    TEXT    NOT NULL,
  commenter_name  TEXT,
  comment_text    TEXT    NOT NULL,
  comment_type    TEXT    NOT NULL DEFAULT 'unknown'
                          CHECK (comment_type IN ('inquiry', 'interest', 'negative', 'spam', 'question', 'praise', 'unknown')),
  reply_sent      BOOLEAN NOT NULL DEFAULT false,
  reply_text      TEXT,
  replied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Direct messages received on Instagram / Facebook Messenger
CREATE TABLE IF NOT EXISTS social_dms (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  platform     TEXT    NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  sender_id    TEXT    NOT NULL,
  sender_name  TEXT,
  message_id   TEXT    UNIQUE,                    -- dedup key
  message_text TEXT    NOT NULL,
  reply_sent   BOOLEAN NOT NULL DEFAULT false,
  reply_text   TEXT,
  replied_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Scheduled posts queue (n8n / cron integration)
CREATE TABLE IF NOT EXISTS post_schedule (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id   UUID    REFERENCES listings(id) ON DELETE CASCADE,
  platform     TEXT    NOT NULL CHECK (platform IN ('instagram', 'facebook', 'both')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
  post_id      UUID    REFERENCES social_posts(id) ON DELETE SET NULL,
  created_by   UUID    REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sp_listing   ON social_posts(listing_id);
CREATE INDEX IF NOT EXISTS idx_sp_status    ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_sp_platform  ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_sp_published ON social_posts(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_sc_post      ON social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_sc_platform  ON social_comments(platform);
CREATE INDEX IF NOT EXISTS idx_sc_replied   ON social_comments(reply_sent);
CREATE INDEX IF NOT EXISTS idx_sc_created   ON social_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sd_sender    ON social_dms(sender_id);
CREATE INDEX IF NOT EXISTS idx_sd_platform  ON social_dms(platform);
CREATE INDEX IF NOT EXISTS idx_sd_replied   ON social_dms(reply_sent);
CREATE INDEX IF NOT EXISTS idx_sd_created   ON social_dms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ps_scheduled ON post_schedule(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ps_status    ON post_schedule(status);

-- ── Disable RLS (admin-only tables, accessed via service role) ────────────────

ALTER TABLE social_posts     DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_dms       DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_schedule    DISABLE ROW LEVEL SECURITY;

-- ── Enable realtime for admin panel (safe — skips if already added) ──────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE social_posts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE social_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE social_dms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
