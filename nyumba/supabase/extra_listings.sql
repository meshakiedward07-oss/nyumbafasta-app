-- ─────────────────────────────────────────────────────────────────
-- Extra listings feature — run these in Supabase SQL Editor in order
-- ─────────────────────────────────────────────────────────────────

-- 1. Add extra_listings columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS extra_listings       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_listings_fee   integer DEFAULT 0;

-- 2. Function: total listing limit for a dalali (plan + extras)
CREATE OR REPLACE FUNCTION get_listing_limit(dalali_user_id uuid)
RETURNS integer AS $$
DECLARE
  total integer;
BEGIN
  SELECT
    CASE
      WHEN s.plan = 'basic'      THEN 5
      WHEN s.plan = 'premium'    THEN 20
      WHEN s.plan = 'enterprise' THEN 50
      ELSE 0
    END + COALESCE(s.extra_listings, 0)
  INTO total
  FROM subscriptions s
  WHERE s.dalali_id = dalali_user_id
    AND s.status = 'active'
  ORDER BY s.expires_at DESC
  LIMIT 1;

  RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function: count active+pending listings for a dalali
CREATE OR REPLACE FUNCTION get_active_listings_count(dalali_user_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM listings
    WHERE dalali_id = dalali_user_id
      AND status IN ('active', 'pending')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enterprise plan — subscriptions.plan is stored as text so no enum change needed
--    If you have a check constraint, update it:
-- ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
-- ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
--   CHECK (plan IN ('basic', 'premium', 'enterprise'));
