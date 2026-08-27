-- ═══════════════════════════════════════════════════════════════════════════
-- perf_rls_auth_wrapping_2026_08_27.sql
-- Run in Supabase SQL Editor. Safe to re-run (idempotent — a policy already
-- wrapped won't match the WHERE filter again).
--
-- The single biggest available database performance win found in this
-- audit. Nearly every RLS policy in this database calls auth.uid()/
-- auth.jwt() directly inside USING/WITH CHECK, e.g.:
--   USING (dalali_id = auth.uid())
-- Postgres treats an unwrapped auth.uid() call as something it must
-- re-evaluate for EVERY ROW the policy is checked against. Wrapping it in a
-- scalar subquery — USING (dalali_id = (select auth.uid())) — lets Postgres
-- evaluate it ONCE per query and reuse the result (auth.uid() is STABLE, not
-- VOLATILE, so this is 100% behavior-preserving, purely a planner hint).
-- This is Supabase's own official documented RLS performance
-- recommendation. On any table with more than a few hundred rows this is
-- commonly a 10-100x difference for RLS-gated queries — and in this app,
-- RLS gates nearly every table.
--
-- This migration finds every policy matching the unwrapped pattern and
-- rewrites it via ALTER POLICY, preserving every policy's existing roles,
-- command type, and logic exactly — only wrapping the auth.*() calls.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  new_qual  TEXT;
  new_check TEXT;
  fixed_count INT := 0;
  failed_count INT := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.(uid|jwt)\(\)' AND qual !~ 'select auth\.(uid|jwt)\(\)')
        OR (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|jwt)\(\)' AND with_check !~ 'select auth\.(uid|jwt)\(\)')
      )
  LOOP
    BEGIN
      new_qual  := r.qual;
      new_check := r.with_check;

      IF new_qual IS NOT NULL THEN
        -- Boundary-guarded so we only match a bare `auth.uid()`/`auth.jwt()`
        -- call, never a substring of some other qualified identifier.
        new_qual := regexp_replace(new_qual, '([^a-zA-Z_.]|^)auth\.uid\(\)', '\1(select auth.uid())', 'g');
        new_qual := regexp_replace(new_qual, '([^a-zA-Z_.]|^)auth\.jwt\(\)', '\1(select auth.jwt())', 'g');
      END IF;

      IF new_check IS NOT NULL THEN
        new_check := regexp_replace(new_check, '([^a-zA-Z_.]|^)auth\.uid\(\)', '\1(select auth.uid())', 'g');
        new_check := regexp_replace(new_check, '([^a-zA-Z_.]|^)auth\.jwt\(\)', '\1(select auth.jwt())', 'g');
      END IF;

      -- Postgres itself guarantees qual is NULL for INSERT-only policies and
      -- with_check is NULL for SELECT/DELETE-only policies, so these guards
      -- naturally skip the clause type that wouldn't apply to this policy.
      IF new_qual IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, new_qual);
      END IF;
      IF new_check IS NOT NULL THEN
        EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, new_check);
      END IF;

      fixed_count := fixed_count + 1;
    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE WARNING 'FAILED to optimize policy %.%: %', r.tablename, r.policyname, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'perf_rls_auth_wrapping_2026_08_27.sql complete — % polic(ies) optimized, % failed (see warnings above).', fixed_count, failed_count;
END $$;

-- Verification: should return 0 rows once complete.
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual IS NOT NULL AND qual ~ 'auth\.(uid|jwt)\(\)' AND qual !~ 'select auth\.(uid|jwt)\(\)')
    OR (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|jwt)\(\)' AND with_check !~ 'select auth\.(uid|jwt)\(\)')
  );
