-- NyumbaFasta — Listings: add place_id + address_full columns
-- Run in Supabase SQL Editor

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS place_id    TEXT,
  ADD COLUMN IF NOT EXISTS address_full TEXT;

-- Index for place_id lookups (backfill dedup, exact search)
CREATE INDEX IF NOT EXISTS idx_listings_place_id
  ON listings(place_id)
  WHERE place_id IS NOT NULL;
