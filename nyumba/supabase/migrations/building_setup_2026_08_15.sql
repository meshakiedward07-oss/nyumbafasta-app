-- building_setup_2026_08_15.sql
-- Adds amenities array + fixes any column-name mismatches on property_units
-- Safe to re-run: ADD COLUMN IF NOT EXISTS + DO $$ blocks throughout
-- Paste into Supabase SQL Editor and click Run

-- 1. Amenities array (sebule, jiko, laundry, parking, etc.)
ALTER TABLE property_units
  ADD COLUMN IF NOT EXISTS amenities TEXT[] DEFAULT '{}';

-- 2. unit_type column (apartment, studio, room, shop, office, whole)
ALTER TABLE property_units
  ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'apartment';

-- 3. deposit_months (amana kwa miezi)
ALTER TABLE property_units
  ADD COLUMN IF NOT EXISTS deposit_months INT NOT NULL DEFAULT 1;

-- 4. Rename 'floor' → 'floor_number' if the org_fixes migration created it with the wrong name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_units' AND column_name = 'floor'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_units' AND column_name = 'floor_number'
  ) THEN
    ALTER TABLE property_units RENAME COLUMN floor TO floor_number;
  END IF;
END $$;

-- 5. Rename 'rent_amount' → 'monthly_rent' if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_units' AND column_name = 'rent_amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'property_units' AND column_name = 'monthly_rent'
  ) THEN
    ALTER TABLE property_units RENAME COLUMN rent_amount TO monthly_rent;
  END IF;
END $$;

-- 6. Ensure monthly_rent exists even if neither old column was present
ALTER TABLE property_units
  ADD COLUMN IF NOT EXISTS monthly_rent NUMERIC(12,2) NOT NULL DEFAULT 0;

-- 7. Ensure floor_number exists
ALTER TABLE property_units
  ADD COLUMN IF NOT EXISTS floor_number INT;

-- 8. GIN index for amenities search
CREATE INDEX IF NOT EXISTS idx_property_units_amenities ON property_units USING GIN(amenities);
CREATE INDEX IF NOT EXISTS idx_property_units_floor ON property_units(listing_id, floor_number);
