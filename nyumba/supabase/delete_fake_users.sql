-- ════════════════════════════════════════════════════════
-- delete_fake_users.sql  (v3)
-- Run: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════

DO $$
DECLARE
  fake_ids UUID[];
BEGIN
  SELECT ARRAY(
    SELECT DISTINCT id FROM public.users
    WHERE id::text LIKE 'a1b2c3d4%'
  ) INTO fake_ids;

  IF array_length(fake_ids, 1) IS NULL THEN
    RAISE NOTICE 'Hakuna fake users kwenye public.users — done.';
    RETURN;
  END IF;

  RAISE NOTICE 'Inafuta fake IDs: %', fake_ids;

  -- 1. notifications
  DELETE FROM public.notifications   WHERE user_id   = ANY(fake_ids);

  -- 2. saved_listings (actual column ni client_id)
  DELETE FROM public.saved_listings  WHERE client_id = ANY(fake_ids);

  -- 3. contact_unlocks (cascade itafuta reviews automatically)
  DELETE FROM public.contact_unlocks WHERE client_id = ANY(fake_ids)
                                        OR dalali_id  = ANY(fake_ids);

  -- 4. subscriptions
  DELETE FROM public.subscriptions   WHERE dalali_id = ANY(fake_ids);

  -- 5. listings
  DELETE FROM public.listings        WHERE dalali_id = ANY(fake_ids);

  -- 6. dalali_profiles
  DELETE FROM public.dalali_profiles WHERE user_id   = ANY(fake_ids);

  -- 7. public.users
  DELETE FROM public.users           WHERE id        = ANY(fake_ids);

  RAISE NOTICE 'public.* records deleted OK';
END $$;

-- 8. auth.users (by email)
DELETE FROM auth.users
WHERE email IN (
  'admin@nyumba.co.tz',
  'juma@dalali.co.tz',
  'client@nyumba.co.tz'
);

-- 9. Thibitisha — zote mbili ziwe 0
SELECT
  (SELECT COUNT(*) FROM auth.users
   WHERE email IN ('admin@nyumba.co.tz','juma@dalali.co.tz','client@nyumba.co.tz')
  ) AS auth_zilizobaki,
  (SELECT COUNT(*) FROM public.users
   WHERE id::text LIKE 'a1b2c3d4%'
  ) AS fake_public_zilizobaki;
