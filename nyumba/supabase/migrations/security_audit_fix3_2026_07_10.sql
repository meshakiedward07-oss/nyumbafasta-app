-- ══════════════════════════════════════════════════════════════════════════════
-- security_audit_fix3_2026_07_10.sql
-- Fixes remaining 4 Supabase auth_rls_initplan warnings after fix2.
--
-- Root cause: crm_missing_tables.sql created 3 policies using
--   role IN ('admin', 'staff') in a multi-line EXISTS subquery — missed by
--   single-line grep when writing fix2.  These were never dropped or replaced.
--
-- Also creates public.is_admin_or_staff() STABLE helper for staff access.
-- Run in Supabase SQL Editor → New query.  Safe to re-run (idempotent).
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Add is_admin_or_staff() helper
-- Covers policies that allow both admin AND staff roles.
-- STABLE = evaluated once per query (prevents auth_rls_initplan).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Fix crm_missing_tables.sql policies on ai_recommendations
-- (used role IN ('admin', 'staff') multi-line EXISTS — not caught by fix2 grep)
-- ─────────────────────────────────────────────────────────────────────────────

-- Admin + staff can READ ai_recommendations
DROP POLICY IF EXISTS "Admin staff can read ai_recommendations" ON ai_recommendations;
CREATE POLICY "Admin staff can read ai_recommendations" ON ai_recommendations
  FOR SELECT TO authenticated
  USING (public.is_admin_or_staff());

-- Admin + staff can INSERT ai_recommendations
-- (was FOR INSERT WITH CHECK — still an auth_rls_initplan source)
DROP POLICY IF EXISTS "Admin staff can insert ai_recommendations" ON ai_recommendations;
CREATE POLICY "Admin staff can insert ai_recommendations" ON ai_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_staff());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Fix crm_missing_tables.sql policy on whatsapp_templates
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin staff can manage whatsapp_templates" ON whatsapp_templates;
CREATE POLICY "Admin staff can manage whatsapp_templates" ON whatsapp_templates
  FOR ALL TO authenticated
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4 — Diagnostic: show any remaining policies with old EXISTS pattern
-- Expected result: 0 rows after this migration.
-- If rows still appear, share the output so the remaining ones can be patched.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  LEFT(qual,        200) AS using_clause,
  LEFT(with_check,  200) AS check_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual        ILIKE '%users%role%admin%'
    OR with_check ILIKE '%users%role%admin%'
  )
ORDER BY tablename, policyname;
