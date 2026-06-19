-- Listing Analytics tables
-- Run this manually in the Supabase SQL Editor
-- NOTE: listings table already has view_count, lead_count, share_count columns.
--       These tables add time-series detail on top of those existing totals.

-- ── Detailed view events (time-series) ─────────────────────────
CREATE TABLE IF NOT EXISTS listing_views (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id     UUID REFERENCES listings(id) ON DELETE CASCADE,
  viewer_session TEXT NOT NULL,
  viewer_ip      TEXT,
  source         TEXT DEFAULT 'website',
  -- 'website' | 'whatsapp' | 'instagram' | 'facebook' | 'marketplace'
  viewed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lv_listing  ON listing_views(listing_id);
CREATE INDEX IF NOT EXISTS idx_lv_session  ON listing_views(listing_id, viewer_session, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lv_viewed   ON listing_views(viewed_at DESC);

-- ── Contact click events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listing_contact_clicks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  click_type TEXT NOT NULL,
  -- 'whatsapp' | 'call' | 'contact_unlock'
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lcc_listing ON listing_contact_clicks(listing_id);
CREATE INDEX IF NOT EXISTS idx_lcc_clicked ON listing_contact_clicks(clicked_at DESC);

-- Disable RLS — accessed via service role only
ALTER TABLE listing_views          DISABLE ROW LEVEL SECURITY;
ALTER TABLE listing_contact_clicks DISABLE ROW LEVEL SECURITY;
