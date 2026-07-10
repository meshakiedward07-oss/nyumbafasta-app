-- ══════════════════════════════════════════════════════════════════════════════
-- security_audit_fix4_2026_07_10.sql
-- Fixes the last 2 auth_rls_initplan warnings:
--
--   1. message_classifications → "admin view" policy
--      Table created directly in Supabase dashboard (no migration file).
--      Policy uses EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin').
--
--   2. video_uploads → "admins_all_video_uploads" policy
--      security_audit_2026_07_10.sql stopped at the view-section error before
--      reaching line 244, so the fix was never applied.
--
-- Run in Supabase SQL Editor → New query.
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. message_classifications — fix "admin view" policy
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS message_classifications ENABLE ROW LEVEL SECURITY;

-- Drop by all common names the dashboard may have assigned
DROP POLICY IF EXISTS "admin view"                         ON message_classifications;
DROP POLICY IF EXISTS "admin_view"                         ON message_classifications;
DROP POLICY IF EXISTS "admin_all"                          ON message_classifications;
DROP POLICY IF EXISTS "admin_all_message_classifications"  ON message_classifications;
DROP POLICY IF EXISTS "admins_all_message_classifications" ON message_classifications;
DROP POLICY IF EXISTS "admin read"                         ON message_classifications;
DROP POLICY IF EXISTS "admin_read_message_classifications" ON message_classifications;

CREATE POLICY "admin view" ON message_classifications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DO $$ BEGIN
  CREATE POLICY "mc_service_full" ON message_classifications
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. video_uploads — re-apply admins_all_video_uploads fix
-- (security_audit_2026_07_10.sql errored before reaching this section)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS video_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_video_uploads" ON video_uploads;
CREATE POLICY "admins_all_video_uploads" ON video_uploads
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DO $$ BEGIN
  CREATE POLICY "vu_service_full" ON video_uploads
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — expect 0 rows
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual,       200) AS using_clause,
  LEFT(with_check, 200) AS check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual        ILIKE '%users%role%admin%'
    OR with_check ILIKE '%users%role%admin%'
    OR qual        ILIKE '%users%role%'
    OR with_check  ILIKE '%users%role%'
  )
ORDER BY tablename, policyname;
