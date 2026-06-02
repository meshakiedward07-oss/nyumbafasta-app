-- Fix listings RLS — public sees active only, dalali sees own, admin sees all
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_public_read"   ON public.listings;
DROP POLICY IF EXISTS "listings_dalali_own"    ON public.listings;
DROP POLICY IF EXISTS "listings_dalali_insert" ON public.listings;
DROP POLICY IF EXISTS "listings_dalali_update" ON public.listings;
DROP POLICY IF EXISTS "listings_admin_all"     ON public.listings;

-- Public & clients: active listings only
CREATE POLICY "listings_public_read" ON public.listings
  FOR SELECT USING (status = 'active');

-- Dalali: ALL their own listings (all statuses)
CREATE POLICY "listings_dalali_own" ON public.listings
  FOR SELECT USING (auth.uid() = dalali_id);

-- Dalali: insert & update own listings
CREATE POLICY "listings_dalali_insert" ON public.listings
  FOR INSERT WITH CHECK (auth.uid() = dalali_id);

CREATE POLICY "listings_dalali_update" ON public.listings
  FOR UPDATE USING (auth.uid() = dalali_id);

-- Admin: everything
CREATE POLICY "listings_admin_all" ON public.listings
  FOR ALL USING (public.is_admin());

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'listings' ORDER BY policyname;
