-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: update_transparent_agent trigger used dalali_profiles.id (PK) instead of
-- dalali_profiles.user_id (FK to users). listings.dalali_id is a users.id UUID,
-- so the UPDATE never matched any row and is_transparent_agent was never set.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_transparent_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dalali_id UUID;
  v_total     INTEGER;
  v_with_com  INTEGER;
BEGIN
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
    WHERE user_id = v_dalali_id;   -- FIXED: was "id", must be "user_id"
  ELSE
    UPDATE dalali_profiles
    SET commission_listings_count = 0,
        is_transparent_agent      = false
    WHERE user_id = v_dalali_id;   -- FIXED: was "id", must be "user_id"
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Backfill existing dalali profiles with the correct values now that the
-- trigger is fixed (rows that had commission listings but never got updated)
DO $$
DECLARE
  r RECORD;
  v_total    INTEGER;
  v_with_com INTEGER;
BEGIN
  FOR r IN SELECT DISTINCT dalali_id FROM listings WHERE dalali_id IS NOT NULL LOOP
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE commission_type IS NOT NULL)
    INTO v_total, v_with_com
    FROM listings
    WHERE dalali_id = r.dalali_id
      AND status IN ('active', 'pending');

    IF v_total > 0 THEN
      UPDATE dalali_profiles
      SET commission_listings_count = v_with_com,
          is_transparent_agent      = (v_with_com::float / v_total >= 0.5)
      WHERE user_id = r.dalali_id;
    END IF;
  END LOOP;
END;
$$;
