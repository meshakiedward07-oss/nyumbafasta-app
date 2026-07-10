-- ══════════════════════════════════════════════════════════════════════════════
-- security_audit_fix2_2026_07_10.sql
-- Fixes remaining 42 Supabase security warnings after security_audit_2026_07_10.sql
--
-- What this fixes:
--   1. auth_rls_initplan  — ~30 policies still call auth.uid() inside EXISTS subqueries
--                           (evaluated per-row); replace every admin check with
--                           public.is_admin() which is STABLE (evaluated once).
--   2. function_search_path_mutable — increment_view_count, increment_lead_count,
--                                     increment_share_count lack SET search_path
--   3. rls_disabled_in_public       — tiktok_connections, tiktok_posts never had
--                                     RLS enabled; carousel_posts and 4 accounting
--                                     tables may have been re-disabled by later migrations
--
-- Run in Supabase SQL Editor → New query.  Safe to re-run (idempotent).
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — Fix auth_rls_initplan on all affected policies
-- Pattern: DROP old policy → CREATE new one using public.is_admin()
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1a. listings ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "listings_admin_all" ON listings;
CREATE POLICY "listings_admin_all" ON listings
  FOR ALL USING (public.is_admin());


-- ── 1b. admin_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_logs_admin_only" ON admin_logs;
CREATE POLICY "admin_logs_admin_only" ON admin_logs
  FOR ALL USING (public.is_admin());


-- ── 1c. reports ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reports_admin_all" ON reports;
CREATE POLICY "reports_admin_all" ON reports
  FOR ALL USING (public.is_admin());


-- ── 1d. agent_leads (3 policies) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_leads" ON agent_leads;
CREATE POLICY "admin_read_leads" ON agent_leads
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_write_leads" ON agent_leads;
CREATE POLICY "admin_write_leads" ON agent_leads
  FOR ALL USING (public.is_admin());

-- staff_read_own_leads: preserve assigned_to = auth.uid(), replace admin EXISTS
DROP POLICY IF EXISTS "staff_read_own_leads" ON agent_leads;
CREATE POLICY "staff_read_own_leads" ON agent_leads
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR public.is_admin()
  );


-- ── 1e. dalali_profiles ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_full_access_dalali_profiles" ON dalali_profiles;
CREATE POLICY "admin_full_access_dalali_profiles" ON dalali_profiles
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "dalali_profiles_admin_all" ON dalali_profiles;
CREATE POLICY "dalali_profiles_admin_all" ON dalali_profiles
  FOR ALL USING (public.is_admin());


-- ── 1f. commissions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_commissions" ON commissions;
CREATE POLICY "admin_all_commissions" ON commissions
  FOR ALL USING (public.is_admin());


-- ── 1g. followup_schedules ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_followups" ON followup_schedules;
CREATE POLICY "admin_all_followups" ON followup_schedules
  FOR ALL USING (public.is_admin());


-- ── 1h. lead_communications (2 policies) ─────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_lead_comms" ON lead_communications;
CREATE POLICY "admin_all_lead_comms" ON lead_communications
  FOR ALL USING (public.is_admin());

-- staff_own_lead_comms: preserve agent_leads EXISTS, replace admin EXISTS
DROP POLICY IF EXISTS "staff_own_lead_comms" ON lead_communications;
CREATE POLICY "staff_own_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_communications.lead_id
        AND assigned_to = auth.uid()
    )
    OR public.is_admin()
  );


-- ── 1i. lead_tasks (2 policies) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_lead_tasks" ON lead_tasks;
CREATE POLICY "admin_all_lead_tasks" ON lead_tasks
  FOR ALL USING (public.is_admin());

-- staff_own_lead_tasks: preserve assigned_to + agent_leads EXISTS, replace admin EXISTS
DROP POLICY IF EXISTS "staff_own_lead_tasks" ON lead_tasks;
CREATE POLICY "staff_own_lead_tasks" ON lead_tasks
  FOR ALL USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_tasks.lead_id
        AND assigned_to = auth.uid()
    )
    OR public.is_admin()
  );


-- ── 1j. call_logs (2 policies) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_call_logs" ON call_logs;
CREATE POLICY "admin_all_call_logs" ON call_logs
  FOR ALL USING (public.is_admin());

-- staff_own_call_logs: preserve dalali_id + agent_leads EXISTS, replace admin EXISTS
DROP POLICY IF EXISTS "staff_own_call_logs" ON call_logs;
CREATE POLICY "staff_own_call_logs" ON call_logs
  FOR ALL USING (
    dalali_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = call_logs.lead_id
        AND assigned_to = auth.uid()
    )
    OR public.is_admin()
  );


-- ── 1k. ai_recommendations ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_ai_recs" ON ai_recommendations;
CREATE POLICY "admin_all_ai_recs" ON ai_recommendations
  FOR ALL USING (public.is_admin());


-- ── 1l. staff_permissions ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_staff_permissions" ON staff_permissions;
CREATE POLICY "admin_manage_staff_permissions" ON staff_permissions
  FOR ALL USING (public.is_admin());


-- ── 1m. staff_activity_log ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_activity" ON staff_activity_log;
CREATE POLICY "admin_read_activity" ON staff_activity_log
  FOR SELECT USING (public.is_admin());


-- ── 1n. agreement_versions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_agreement_versions" ON agreement_versions;
CREATE POLICY "admin_manage_agreement_versions" ON agreement_versions
  FOR ALL USING (public.is_admin());


-- ── 1o. user_agreements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_user_agreements" ON user_agreements;
CREATE POLICY "admin_all_user_agreements" ON user_agreements
  FOR ALL USING (public.is_admin());


-- ── 1p. agreement_violations ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_violations" ON agreement_violations;
CREATE POLICY "admin_all_violations" ON agreement_violations
  FOR ALL USING (public.is_admin());


-- ── 1q. app_settings ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin write" ON app_settings;
CREATE POLICY "admin write" ON app_settings
  FOR ALL USING (public.is_admin());


-- ── 1r. listing_occupancy_log ────────────────────────────────────────────────
-- Preserve listings EXISTS (not an admin subquery — must stay); replace admin EXISTS
DROP POLICY IF EXISTS "dalali_read_own_occupancy_log" ON listing_occupancy_log;
CREATE POLICY "dalali_read_own_occupancy_log" ON listing_occupancy_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_occupancy_log.listing_id
        AND dalali_id = auth.uid()
    )
    OR public.is_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Fix function_search_path_mutable on 3 increment functions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_view_count(listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE listings SET view_count = view_count + 1 WHERE id = listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_lead_count(listing_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE listings SET lead_count = lead_count + 1 WHERE id = listing_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_share_count(listing_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE listings
  SET share_count = share_count + 1
  WHERE id = listing_id;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Enable RLS on tables that are still unprotected
-- ─────────────────────────────────────────────────────────────────────────────

-- tiktok_connections + tiktok_posts: created in tiktok_social.sql without ENABLE RLS
ALTER TABLE tiktok_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_posts       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON tiktok_connections
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON tiktok_posts
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- carousel_posts: disabled in carousel_posts.sql
ALTER TABLE carousel_posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON carousel_posts
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4 accounting tables: disabled in income_records_and_analytics_2026_07_07.sql
ALTER TABLE income_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON income_records
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON expense_records
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON financial_summaries
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "service_role_only" ON recurring_expenses
    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — count remaining auth_rls_initplan patterns in live policies
-- (expect 0 rows from the admin EXISTS pattern after this migration)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  LEFT(qual, 120) AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND qual ILIKE '%users%role%admin%'
ORDER BY tablename, policyname;
