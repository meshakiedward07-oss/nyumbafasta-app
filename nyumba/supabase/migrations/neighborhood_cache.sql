-- Neighborhood info cache — avoids repeated Google Places API calls
-- Run this manually in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS neighborhood_cache (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id   UUID REFERENCES listings(id) ON DELETE CASCADE,

  latitude     DECIMAL(10,8) NOT NULL,
  longitude    DECIMAL(11,8) NOT NULL,

  schools      JSONB DEFAULT '[]',
  hospitals    JSONB DEFAULT '[]',
  markets      JSONB DEFAULT '[]',
  transport    JSONB DEFAULT '[]',
  banks        JSONB DEFAULT '[]',

  cbd_distance_km  DECIMAL(6,2),
  cbd_duration_min INTEGER,

  fetched_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',

  UNIQUE(listing_id)
);

CREATE INDEX IF NOT EXISTS idx_nc_listing ON neighborhood_cache(listing_id);
CREATE INDEX IF NOT EXISTS idx_nc_expires  ON neighborhood_cache(expires_at);

-- Disable RLS — accessed via service role only
ALTER TABLE neighborhood_cache DISABLE ROW LEVEL SECURITY;
