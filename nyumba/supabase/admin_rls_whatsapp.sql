-- ─────────────────────────────────────────────────────────────────────────────
-- Admin RLS: hakikisha admin anaona dalali_profiles zote (whatsapp_number etc)
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function — kama haipo tayari
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- Policy: admin anaona records zote za dalali_profiles
DROP POLICY IF EXISTS "dalali_profiles_admin_all" ON dalali_profiles;
CREATE POLICY "dalali_profiles_admin_all" ON dalali_profiles
  FOR ALL
  USING (public.is_admin());

-- Thibitisha policies zilizopo
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'dalali_profiles'
ORDER BY policyname;
