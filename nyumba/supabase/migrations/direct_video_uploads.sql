-- Direct Video Uploads for Social Media
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS video_uploads (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  video_url    TEXT        NOT NULL,         -- Cloudinary URL
  file_size    INTEGER,                       -- bytes
  video_type   TEXT        NOT NULL DEFAULT 'promotion'
                           CHECK (video_type IN ('promotion','listing_tour','announcement','testimonial','other')),
  platforms    TEXT[]      DEFAULT '{}',      -- ['instagram','facebook']
  caption_ig   TEXT,
  caption_fb   TEXT,
  post_status  TEXT        NOT NULL DEFAULT 'draft'
                           CHECK (post_status IN ('draft','scheduled','posting','posted','failed')),
  ig_post_id   TEXT,
  fb_post_id   TEXT,
  scheduled_at TIMESTAMPTZ,
  posted_at    TIMESTAMPTZ,
  error_message TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vu_admin   ON video_uploads(admin_id);
CREATE INDEX IF NOT EXISTS idx_vu_status  ON video_uploads(post_status);
CREATE INDEX IF NOT EXISTS idx_vu_created ON video_uploads(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_video_uploads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_video_uploads_updated_at ON video_uploads;
CREATE TRIGGER trg_video_uploads_updated_at
  BEFORE UPDATE ON video_uploads
  FOR EACH ROW EXECUTE FUNCTION update_video_uploads_updated_at();

-- RLS: admins can read/write all; no client access
ALTER TABLE video_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_all_video_uploads"
  ON video_uploads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
