-- ══════════════════════════════════════════════════════════════════════════════
-- commission_feature_2026_07_10.sql
-- Adds optional commission fields to listings so dalali can disclose
-- their commission to clients after contact-unlock payment.
--
-- Changes:
--   1. listings — commission_type, commission_value, commission_notes
--   2. dalali_profiles — is_transparent_agent, commission_listings_count
--   3. Trigger: auto-updates is_transparent_agent when ≥50% of dalali's
--      active/pending listings have commission set.
--
-- Run in Supabase SQL Editor → New query (NOT in a migration runner that
-- wraps statements in a transaction, since the trigger DDL must run freely).
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add commission columns to listings
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT NULL
    CONSTRAINT listings_commission_type_check
    CHECK (commission_type IN ('one_month', 'percentage', 'fixed', 'negotiable')),
  ADD COLUMN IF NOT EXISTS commission_value NUMERIC(12, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_notes TEXT DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add transparent-agent columns to dalali_profiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE dalali_profiles
  ADD COLUMN IF NOT EXISTS is_transparent_agent BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_listings_count INTEGER DEFAULT 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper function: recalculate transparent-agent status for one dalali
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_transparent_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dalali_id UUID;
  v_total     INT;
  v_with_com  INT;
BEGIN
  -- Works for INSERT / UPDATE (NEW) and DELETE (NEW is null → use OLD)
  v_dalali_id := COALESCE(NEW.dalali_id, OLD.dalali_id);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE commission_type IS NOT NULL)
  INTO v_total, v_with_com
  FROM listings
  WHERE dalali_id = v_dalali_id
    AND status IN ('active', 'pending');

  IF v_total > 0 THEN
    UPDATE dalali_profiles
    SET
      commission_listings_count = v_with_com,
      is_transparent_agent      = (v_with_com::float / v_total >= 0.5)
    WHERE id = v_dalali_id;
  ELSE
    UPDATE dalali_profiles
    SET commission_listings_count = 0,
        is_transparent_agent      = false
    WHERE id = v_dalali_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Attach trigger to listings
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_update_transparent_agent ON listings;

CREATE TRIGGER trg_update_transparent_agent
AFTER INSERT OR UPDATE OF commission_type, status OR DELETE
ON listings
FOR EACH ROW
EXECUTE FUNCTION public.update_transparent_agent();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_listings_commission_type
  ON listings(commission_type)
  WHERE commission_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dalali_profiles_transparent
  ON dalali_profiles(is_transparent_agent)
  WHERE is_transparent_agent = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'listings'
  AND column_name IN ('commission_type', 'commission_value', 'commission_notes')
ORDER BY column_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dalali_profiles'
  AND column_name IN ('is_transparent_agent', 'commission_listings_count')
ORDER BY column_name;
