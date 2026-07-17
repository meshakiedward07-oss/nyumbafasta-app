-- Ad Impressions table for per-session frequency capping
-- PK on (session_id, campaign_id) — one row per ad per session window
-- shown_at is updated on UPSERT so the 4-hour window resets on re-show

CREATE TABLE IF NOT EXISTS ad_impressions (
  session_id   text        NOT NULL,
  campaign_id  uuid        NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  shown_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, campaign_id)
);

-- Fast lookup: recent impressions for a session within the 4-hour window
CREATE INDEX IF NOT EXISTS idx_ad_impressions_session_shown
  ON ad_impressions (session_id, shown_at DESC);

-- RLS: only service role can read/write (client never touches this directly)
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;

-- No client-side RLS policies — all access via service role key (admin client)
