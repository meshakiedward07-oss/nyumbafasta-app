-- NyumbaFasta — Listings: add ward, mtaa, location_display columns
-- Run in Supabase SQL Editor

-- ── 1. Add new location columns ─────────────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS ward             TEXT,         -- Kata
  ADD COLUMN IF NOT EXISTS mtaa             TEXT,         -- Mtaa/Kijiji
  ADD COLUMN IF NOT EXISTS location_display TEXT;         -- auto-generated display string

-- ── 2. Trigger: auto-generate location_display on insert/update ─────────────
CREATE OR REPLACE FUNCTION generate_location_display()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location_display :=
    CONCAT_WS(', ',
      NULLIF(TRIM(NEW.mtaa),     ''),
      NULLIF(TRIM(NEW.ward),     ''),
      NULLIF(TRIM(NEW.district), '')
    )
    || CASE
         WHEN NEW.region IS NOT NULL AND TRIM(NEW.region) <> ''
         THEN ' — ' || TRIM(NEW.region)
         ELSE ''
       END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_location_display ON listings;
CREATE TRIGGER trg_location_display
  BEFORE INSERT OR UPDATE OF region, district, ward, mtaa ON listings
  FOR EACH ROW
  EXECUTE FUNCTION generate_location_display();

-- ── 3. Backfill location_display for existing rows ───────────────────────────
UPDATE listings SET
  location_display =
    CONCAT_WS(', ',
      NULLIF(TRIM(mtaa),     ''),
      NULLIF(TRIM(ward),     ''),
      NULLIF(TRIM(district), '')
    )
    || CASE
         WHEN region IS NOT NULL AND TRIM(region) <> ''
         THEN ' — ' || TRIM(region)
         ELSE ''
       END
WHERE location_display IS NULL;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_ward ON listings(ward);
CREATE INDEX IF NOT EXISTS idx_listings_mtaa ON listings(mtaa);

-- ── 5. Verify ─────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listings'
  AND column_name IN ('region','district','ward','mtaa','location_display','address_full','place_id')
ORDER BY column_name;
