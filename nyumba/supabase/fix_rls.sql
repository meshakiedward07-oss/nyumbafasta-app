-- ════════════════════════════════════════════════════════════════
-- Nyumba App — Fix RLS + Admin Access (v2)
-- Run in Supabase Dashboard → SQL Editor
--
-- Inashughulikia matatizo 3:
--   1. saved_listings.user_id → client_id  (ilikuwa inasababisha
--      "database error querying schema" kwa authenticated users)
--   2. Admin user kwenye public.users kupata UUID sahihi kutoka
--      auth.users (ilikuwa hailinganishi → redirect kila wakati)
--   3. Admin policies hazikuwekwa kwenye tables nyingine
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- SEHEMU A: Sync auth.users → public.users
-- Hii inahakikisha admin na users wengine walioandikwa manually
-- kwenye auth.users wanaonekana kwenye public.users na UUID sahihi
-- ────────────────────────────────────────────────────────────────

INSERT INTO public.users (id, phone, full_name, role, is_verified, is_active)
SELECT
  au.id,
  -- phone NOT NULL: email-based users hawana phone, tumia '' kama fallback
  COALESCE(au.phone, ''),
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1),
    'Mtumiaji'
  ),
  -- Cast TEXT → user_role enum (fix: 42804 column "role" is of type user_role)
  COALESCE(au.raw_user_meta_data->>'role', 'client')::user_role,
  true,
  true
FROM auth.users au
ON CONFLICT (id) DO UPDATE
  SET
    role      = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    -- Sasisha phone tu kama ipo (usiandike '' juu ya nambari iliyopo)
    phone     = CASE
                  WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone
                  ELSE public.users.phone
                END;

-- Thibitisha admin ana role sahihi (manual override kama meta_data haikuwekwa)
UPDATE public.users
SET role = 'admin'::user_role
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email ILIKE '%admin%'
     OR raw_user_meta_data->>'role' = 'admin'
);

-- ────────────────────────────────────────────────────────────────
-- SEHEMU B: Fix handle_new_user trigger
-- Ilikuwa inasababisha "column role is of type user_role but expression
-- is of type text" kwa kila user mpya anayejiandikisha
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Mtumiaji'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- SEHEMU C: Helper function — is_admin()
-- SECURITY DEFINER inaruka RLS kwenye subquery ya users table,
-- inazuia infinite recursion na inaharakisha admin checks
-- ────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────
-- SEHEMU D: Rekebisha RLS policies — tables zote
-- ────────────────────────────────────────────────────────────────

-- ── users ─────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own"       ON public.users;
DROP POLICY IF EXISTS "users_update_own"     ON public.users;
DROP POLICY IF EXISTS "users_public_basic"   ON public.users;
DROP POLICY IF EXISTS "users_public_read"    ON public.users;
DROP POLICY IF EXISTS "users_admin_all"      ON public.users;

-- Kila mtu anaweza kusoma users (dalali cards, reviews, names)
CREATE POLICY "users_public_read" ON public.users
  FOR SELECT USING (true);

-- Mtumiaji anasasisha rekodi yake mwenyewe tu
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admin anasimamia users wote
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL USING (public.is_admin());

-- ── listings ──────────────────────────────────────────────────
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_public_read"   ON public.listings;
DROP POLICY IF EXISTS "listings_dalali_own"    ON public.listings;
DROP POLICY IF EXISTS "listings_dalali_insert" ON public.listings;
DROP POLICY IF EXISTS "listings_dalali_update" ON public.listings;
DROP POLICY IF EXISTS "listings_admin_all"     ON public.listings;

CREATE POLICY "listings_public_read" ON public.listings
  FOR SELECT USING (status = 'active');

CREATE POLICY "listings_dalali_own" ON public.listings
  FOR SELECT USING (auth.uid() = dalali_id);

CREATE POLICY "listings_dalali_insert" ON public.listings
  FOR INSERT WITH CHECK (auth.uid() = dalali_id);

CREATE POLICY "listings_dalali_update" ON public.listings
  FOR UPDATE USING (auth.uid() = dalali_id);

CREATE POLICY "listings_admin_all" ON public.listings
  FOR ALL USING (public.is_admin());

-- ── dalali_profiles ────────────────────────────────────────────
ALTER TABLE public.dalali_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dalali_profiles_public_read"  ON public.dalali_profiles;
DROP POLICY IF EXISTS "dalali_profiles_own_insert"   ON public.dalali_profiles;
DROP POLICY IF EXISTS "dalali_profiles_own_update"   ON public.dalali_profiles;
DROP POLICY IF EXISTS "dalali_profiles_admin_all"    ON public.dalali_profiles;

CREATE POLICY "dalali_profiles_public_read" ON public.dalali_profiles
  FOR SELECT USING (true);

CREATE POLICY "dalali_profiles_own_insert" ON public.dalali_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dalali_profiles_own_update" ON public.dalali_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "dalali_profiles_admin_all" ON public.dalali_profiles
  FOR ALL USING (public.is_admin());

-- ── subscriptions ─────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_own"       ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_all" ON public.subscriptions;

CREATE POLICY "subscriptions_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = dalali_id);

CREATE POLICY "subscriptions_admin_all" ON public.subscriptions
  FOR ALL USING (public.is_admin());

-- ── contact_unlocks ────────────────────────────────────────────
ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unlocks_client_read"   ON public.contact_unlocks;
DROP POLICY IF EXISTS "unlocks_client_insert" ON public.contact_unlocks;
DROP POLICY IF EXISTS "unlocks_dalali_read"   ON public.contact_unlocks;
DROP POLICY IF EXISTS "unlocks_admin_all"     ON public.contact_unlocks;

-- Client anaona unlocks zake
CREATE POLICY "unlocks_client_read" ON public.contact_unlocks
  FOR SELECT USING (auth.uid() = client_id);

-- Client anaanzisha unlock (kulipa)
CREATE POLICY "unlocks_client_insert" ON public.contact_unlocks
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- Dalali anaona watu waliofungua listings zake
CREATE POLICY "unlocks_dalali_read" ON public.contact_unlocks
  FOR SELECT USING (auth.uid() = dalali_id);

-- Admin anaona na kusimamia unlocks zote
CREATE POLICY "unlocks_admin_all" ON public.contact_unlocks
  FOR ALL USING (public.is_admin());

-- ── saved_listings ─────────────────────────────────────────────
-- !! MAREKEBISHO MUHIMU: ilikuwa inatumia "user_id" ambayo haipo
-- Column sahihi ni "client_id" — hii ndiyo chanzo cha
-- "database error querying schema"
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_own"       ON public.saved_listings;
DROP POLICY IF EXISTS "saved_admin_all" ON public.saved_listings;

CREATE POLICY "saved_own" ON public.saved_listings
  FOR ALL USING (auth.uid() = client_id);        -- ilikuwa user_id ❌

CREATE POLICY "saved_admin_all" ON public.saved_listings
  FOR ALL USING (public.is_admin());

-- ── reviews ───────────────────────────────────────────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_read"   ON public.reviews;
DROP POLICY IF EXISTS "reviews_client_insert" ON public.reviews;
DROP POLICY IF EXISTS "reviews_admin_all"     ON public.reviews;

CREATE POLICY "reviews_public_read" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_client_insert" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "reviews_admin_all" ON public.reviews
  FOR ALL USING (public.is_admin());

-- ── notifications ──────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own"       ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;

CREATE POLICY "notifications_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL USING (public.is_admin());

-- ────────────────────────────────────────────────────────────────
-- SEHEMU E: Thibitisha — orodhesha policies na users
-- ────────────────────────────────────────────────────────────────

SELECT
  p.tablename,
  p.policyname,
  p.cmd,
  p.permissive
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;
