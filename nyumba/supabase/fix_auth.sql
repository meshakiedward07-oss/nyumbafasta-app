-- ════════════════════════════════════════════════════════════════
-- Nyumba App — fix_auth.sql
-- Run in Supabase Dashboard → SQL Editor
-- Inashughulikia:
--   • "Database error querying schema"  → handle_new_user trigger
--   • "Database error saving new user"  → handle_new_user trigger
--   • saved_listings broken RLS policy  → user_id → client_id
-- ════════════════════════════════════════════════════════════════

-- ── 1. Ondoa trigger kwanza, kisha recreate function ────────────
-- Kama function ina cached plan yenye hitilafu, DROP + RECREATE
-- ndiyo njia pekee ya kuifuta kabisa.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             split_part(COALESCE(NEW.email, ''), '@', 1),
             'Mtumiaji'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. is_admin() helper (inahitajika na policies) ──────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 3. Fix saved_listings — user_id → client_id ─────────────────
-- Ilikuwa: USING (auth.uid() = user_id) — column haipo
-- Sasa:    USING (auth.uid() = client_id)

ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_own"       ON public.saved_listings;
DROP POLICY IF EXISTS "saved_admin_all" ON public.saved_listings;

CREATE POLICY "saved_own" ON public.saved_listings
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "saved_admin_all" ON public.saved_listings
  FOR ALL USING (public.is_admin());

-- ── 4. Admin policies zilizokosekana ────────────────────────────
DROP POLICY IF EXISTS "listings_admin_all"   ON public.listings;
DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;
DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;
DROP POLICY IF EXISTS "unlocks_admin_all"    ON public.contact_unlocks;
DROP POLICY IF EXISTS "reviews_admin_all"    ON public.reviews;

CREATE POLICY "listings_admin_all" ON public.listings
  FOR ALL USING (public.is_admin());

CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
  FOR ALL USING (public.is_admin());

CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL USING (public.is_admin());

CREATE POLICY "unlocks_admin_all" ON public.contact_unlocks
  FOR ALL USING (public.is_admin());

CREATE POLICY "reviews_admin_all" ON public.reviews
  FOR ALL USING (public.is_admin());

-- ── 5. Hakikisha users wote wa auth.users wako kwenye public.users
-- (bila kukiuka NOT NULL ya phone)
INSERT INTO public.users (id, phone, full_name, role)
SELECT
  au.id,
  COALESCE(au.phone, ''),
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    split_part(COALESCE(au.email,''), '@', 1),
    'Mtumiaji'
  ),
  COALESCE(au.raw_user_meta_data->>'role', 'client')::user_role
FROM auth.users au
ON CONFLICT (id) DO UPDATE
  SET
    role = EXCLUDED.role,
    full_name = CASE
      WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
      ELSE public.users.full_name
    END,
    phone = CASE
      WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone
      ELSE public.users.phone
    END;

-- Override: users wenye email *admin* wanapata role ya admin
UPDATE public.users
SET role = 'admin'::user_role
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email ILIKE '%admin%'
     OR raw_user_meta_data->>'role' = 'admin'
);
