-- ── Instagram Carousel Posts ───────────────────────────────────────────────
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS carousel_posts (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id    UUID        REFERENCES listings(id) ON DELETE SET NULL,
  post_id       TEXT,
  media_urls    TEXT[],
  caption       TEXT,
  slides_count  INTEGER,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','posted','failed')),
  error_message TEXT,
  likes         INTEGER     NOT NULL DEFAULT 0,
  comments      INTEGER     NOT NULL DEFAULT 0,
  reach         INTEGER     NOT NULL DEFAULT 0,
  posted_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cp_listing ON carousel_posts(listing_id);
CREATE INDEX IF NOT EXISTS idx_cp_status  ON carousel_posts(status);
CREATE INDEX IF NOT EXISTS idx_cp_created ON carousel_posts(created_at DESC);

ALTER TABLE carousel_posts DISABLE ROW LEVEL SECURITY;
