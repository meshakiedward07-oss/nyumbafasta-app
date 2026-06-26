-- ── Add location columns to listings ─────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS latitude    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_full TEXT,
  ADD COLUMN IF NOT EXISTS place_id    TEXT;

-- Index for geo queries
CREATE INDEX IF NOT EXISTS idx_listings_coords
  ON listings(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── Verify ────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listings'
  AND column_name IN ('latitude','longitude','address_full','place_id')
ORDER BY column_name;
