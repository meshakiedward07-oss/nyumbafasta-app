-- ── Database Audit Fixes 2026-07-04 ─────────────────────────────────────────
-- Addresses findings from full DB security + quality audit.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to run multiple times (idempotent via IF NOT EXISTS / DO...EXCEPTION).

-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL C2: Confirm column-level REVOKE on whatsapp_number
-- (security_whatsapp_rls_2026_07_03.sql should already have done this;
--  re-apply idempotently so it's guaranteed regardless of run order)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE SELECT (whatsapp_number) ON dalali_profiles FROM anon;
REVOKE SELECT (whatsapp_number) ON dalali_profiles FROM authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH H1: Verify 27 tables have RLS enabled
-- (rls_missing_tables.sql applies these; included here for completeness
--  as idempotent ENABLE is safe even if already on)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS whatsapp_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whatsapp_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whatsapp_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whatsapp_broadcasts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS amina_instructions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS income_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expense_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS financial_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recurring_expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_dms               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_schedule            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fb_posting_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS facebook_group_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS instagram_stories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS carousel_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketplace_listings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketplace_inquiries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS spam_comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS spam_keywords            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS spam_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_performance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS posting_recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS listing_views            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS listing_contact_clicks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS neighborhood_cache       ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH H3: boost_payments — enable RLS + add policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE boost_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "boost_dalali_own" ON boost_payments
    FOR SELECT TO authenticated
    USING (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "boost_admin_all" ON boost_payments
    FOR ALL TO authenticated
    USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "boost_service_full" ON boost_payments
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM M1a: dalali_account_warnings — enable RLS + add policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS dalali_account_warnings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "daw_dalali_read_own" ON dalali_account_warnings
    FOR SELECT TO authenticated
    USING (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "daw_admin_all" ON dalali_account_warnings
    FOR ALL TO authenticated
    USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "daw_service_full" ON dalali_account_warnings
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM M1b: recently_viewed — enable RLS + add policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE recently_viewed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "rv_own_all" ON recently_viewed
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rv_service_full" ON recently_viewed
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM M2: tiktok_connections + tiktok_posts — add user-level policies
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "tiktok_conn_own" ON tiktok_connections
    FOR ALL TO authenticated
    USING (dalali_id = auth.uid()) WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tiktok_posts_own" ON tiktok_posts
    FOR ALL TO authenticated
    USING (dalali_id = auth.uid()) WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM M3: Missing indexes on admin_logs, boost_payments,
--            recurring_expenses, reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_time
  ON admin_logs(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_logs_action
  ON admin_logs(action);

CREATE INDEX IF NOT EXISTS idx_boost_payments_dalali_status
  ON boost_payments(dalali_id, status);

CREATE INDEX IF NOT EXISTS idx_boost_payments_listing
  ON boost_payments(listing_id);

CREATE INDEX IF NOT EXISTS idx_recurring_due
  ON recurring_expenses(next_due_date) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_reports_status_time
  ON reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_reporter
  ON reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_dalali
  ON reports(reported_dalali_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- MEDIUM M4: followup_schedules — add dalali write policy
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "followup_dalali_own" ON followup_schedules
    FOR ALL TO authenticated
    USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- LOW L2: CRM commissions — add dalali insert/update policies
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "commissions_dalali_write" ON commissions
    FOR INSERT TO authenticated
    WITH CHECK (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "commissions_dalali_update" ON commissions
    FOR UPDATE TO authenticated
    USING (dalali_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verify: confirm all target tables have RLS enabled
-- ─────────────────────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'boost_payments', 'dalali_account_warnings', 'recently_viewed',
    'tiktok_connections', 'tiktok_posts', 'followup_schedules', 'commissions',
    'whatsapp_conversations', 'whatsapp_sessions', 'whatsapp_messages',
    'whatsapp_broadcasts', 'amina_instructions', 'income_records',
    'expense_records', 'financial_summaries', 'recurring_expenses',
    'social_posts', 'listing_views', 'listing_contact_clicks',
    'neighborhood_cache', 'marketplace_listings', 'carousel_posts'
  )
ORDER BY tablename;
