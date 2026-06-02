-- Fix saved_listings RLS — split FOR ALL into explicit operations
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_own"       ON public.saved_listings;
DROP POLICY IF EXISTS "saved_admin_all" ON public.saved_listings;
DROP POLICY IF EXISTS "saved_select"    ON public.saved_listings;
DROP POLICY IF EXISTS "saved_insert"    ON public.saved_listings;
DROP POLICY IF EXISTS "saved_delete"    ON public.saved_listings;
DROP POLICY IF EXISTS "saved_admin"     ON public.saved_listings;

CREATE POLICY "saved_select" ON public.saved_listings
  FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "saved_insert" ON public.saved_listings
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "saved_delete" ON public.saved_listings
  FOR DELETE USING (auth.uid() = client_id);

CREATE POLICY "saved_admin" ON public.saved_listings
  FOR ALL USING (public.is_admin());
