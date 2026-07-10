-- ════════════════════════════════════════════════════════════════════════════
-- NyumbaFasta — Security Audit Fix  2026-07-10
-- Fixes 2 errors + ~48 warnings from Supabase Security Advisor
-- Safe to run multiple times (idempotent)
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — Fix 2 ERRORS: dalali_listing_activity view
--
-- Error 1: "auth/exposed-schema"
--   The view joins auth.users → any caller with SELECT on the view can read
--   emails and other PII from the auth schema.
--
-- Error 2: "security-definer-view"
--   PostgreSQL views without security_invoker=on run with the view OWNER's
--   privileges. The owner (postgres/service_role) can read auth.users and can
--   bypass the column-level REVOKE on dalali_profiles.whatsapp_number.
--   Any anon caller who gets SELECT on the view inherits these privileges.
--
-- Fix:
--   • Replace auth.users JOIN with public.users.email (column already exists)
--   • Add WITH (security_invoker = on)  → view runs with caller's permissions
--   • REVOKE from anon + authenticated  → view accessible only via service_role
-- ════════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS dalali_listing_activity;

CREATE VIEW dalali_listing_activity
  WITH (security_invoker = on)
AS
SELECT
  u.id,
  u.full_name                                                  AS name,
  u.phone,
  u.created_at                                                 AS registered_at,
  u.last_listing_at,
  u.listing_warnings_count,
  u.listing_deadline_days,
  u.account_deletion_scheduled_at,
  u.is_active,
  dp.whatsapp_number,
  s.plan                                                       AS subscription_plan,

  EXTRACT(DAY FROM NOW() - u.created_at)::INTEGER              AS days_since_registration,

  CASE
    WHEN u.last_listing_at IS NOT NULL
    THEN EXTRACT(DAY FROM NOW() - u.last_listing_at)::INTEGER
    ELSE NULL
  END                                                          AS days_since_last_listing,

  COUNT(l.id)                                                  AS total_listings_ever,
  COUNT(CASE WHEN l.status = 'active' THEN 1 END)              AS active_listings,

  CASE
    WHEN COUNT(l.id) = 0
    THEN u.listing_deadline_days
         - EXTRACT(DAY FROM NOW() - u.created_at)::INTEGER
    ELSE NULL
  END                                                          AS days_before_deletion,

  CASE
    WHEN COUNT(l.id) > 0                                       THEN 'safe'
    WHEN EXTRACT(DAY FROM NOW() - u.created_at) <  30         THEN 'new'
    WHEN EXTRACT(DAY FROM NOW() - u.created_at) <  60         THEN 'at_risk'
    WHEN EXTRACT(DAY FROM NOW() - u.created_at) <  85         THEN 'critical'
    ELSE                                                            'overdue'
  END                                                          AS risk_level

FROM users u
LEFT JOIN dalali_profiles dp ON dp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT plan FROM subscriptions
  WHERE dalali_id = u.id
    AND status::text IN ('active', 'grace_period')
  ORDER BY created_at DESC
  LIMIT 1
) s ON true
LEFT JOIN listings l ON l.dalali_id = u.id
WHERE u.role = 'dalali'
GROUP BY
  u.id, u.full_name, u.phone, u.created_at,
  u.last_listing_at, u.listing_warnings_count, u.listing_deadline_days,
  u.account_deletion_scheduled_at, u.is_active,
  dp.whatsapp_number, s.plan;

-- Lock view: only service_role (admin API) may query it
REVOKE ALL   ON dalali_listing_activity FROM anon;
REVOKE ALL   ON dalali_listing_activity FROM authenticated;
GRANT  SELECT ON dalali_listing_activity TO service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Fix SECURITY DEFINER functions: add SET search_path = public
--
-- Without SET search_path, a SECURITY DEFINER function can be exploited via
-- search_path injection — an attacker creates a fake schema with shadow tables
-- and gets the function (running as superuser/postgres) to query those instead.
-- Supabase flags each such function as "function-search-path-mutable".
-- ════════════════════════════════════════════════════════════════════════════

-- ── 2a. handle_new_user (trigger: auth.users → public.users) ────────────────
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
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Mtumiaji'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2b. is_admin() helper ───────────────────────────────────────────────────
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

-- ── 2c. get_listing_limit() ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_listing_limit(dalali_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
BEGIN
  SELECT
    CASE
      WHEN s.plan = 'basic'      THEN 5
      WHEN s.plan = 'premium'    THEN 20
      WHEN s.plan = 'enterprise' THEN 50
      ELSE 0
    END + COALESCE(s.extra_listings, 0)
  INTO total
  FROM subscriptions s
  WHERE s.dalali_id = dalali_user_id
    AND s.status = 'active'
  ORDER BY s.expires_at DESC
  LIMIT 1;

  RETURN COALESCE(total, 0);
END;
$$;

-- ── 2d. get_active_listings_count() ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_listings_count(dalali_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM listings
    WHERE dalali_id = dalali_user_id
      AND status IN ('active', 'pending')
  );
END;
$$;

-- ── 2e. update_dalali_last_listing (trigger — no SD, but fix search_path) ───
CREATE OR REPLACE FUNCTION public.update_dalali_last_listing()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE users SET
    last_listing_at               = NOW(),
    account_deletion_scheduled_at = NULL,
    listing_warnings_count        = 0,
    listing_warning_sent_at       = NULL
  WHERE id = NEW.dalali_id;
  RETURN NEW;
END;
$$;

-- ── 2f. update_updated_at (generic trigger) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — Enable RLS on tables not yet covered
--
-- chat_sessions and chat_messages are used by the AI agent but were not
-- included in any previous RLS migration. Service-role-only lockdown.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON chat_sessions;
CREATE POLICY "service_role_only" ON chat_sessions
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON chat_messages;
CREATE POLICY "service_role_only" ON chat_messages
  USING (false) WITH CHECK (false);

-- video_uploads: tighten existing policy to use is_admin() for consistency
ALTER TABLE IF EXISTS video_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_all_video_uploads" ON video_uploads;
DO $$ BEGIN
  CREATE POLICY "admins_all_video_uploads" ON video_uploads
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vu_service_full" ON video_uploads
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — Revoke write grants from anon role
--
-- fix_permissions.sql ran:  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon
-- This gives INSERT/UPDATE/DELETE to unauthenticated users on every table.
-- RLS blocks unauthorized access, but Supabase still warns about the grant
-- itself (one warning per table × ~40 tables = large chunk of the 48).
--
-- anon users only need SELECT on public-read tables. All writes require auth.
-- ════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON ALL TABLES IN SCHEMA public
  FROM anon;

-- Re-grant service_role full access (in case above caught it)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — Idempotent service_role policies for tables that missed them
--
-- Some tables had RLS enabled via db_audit_fixes_2026_07_04.sql but may not
-- have gotten the service_role bypass policy. Add defensively.
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE POLICY "sr_full" ON whatsapp_conversations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON whatsapp_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON whatsapp_messages
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON whatsapp_broadcasts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON amina_instructions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON income_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON expense_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON financial_summaries
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON recurring_expenses
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON social_posts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON social_comments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON social_dms
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON post_schedule
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON fb_posting_groups
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON facebook_group_posts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON instagram_stories
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON marketplace_listings
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON marketplace_inquiries
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON listing_views
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON listing_contact_clicks
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON security_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON dalali_account_warnings
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON dalali_income
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON dalali_expenses
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON dalali_commissions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sr_full" ON dalali_goals
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — Re-confirm whatsapp_number column REVOKE
-- (guarantees dalali WhatsApp numbers are never accessible to anon/authenticated
--  even if fix_permissions.sql GRANT ALL was run after the security migration)
-- ════════════════════════════════════════════════════════════════════════════

REVOKE SELECT (whatsapp_number) ON dalali_profiles FROM anon;
REVOKE SELECT (whatsapp_number) ON dalali_profiles FROM authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY — run this to confirm fixes applied
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Confirm view no longer references auth schema
SELECT COUNT(*) AS auth_refs_in_view
FROM pg_depend d
JOIN pg_class c  ON c.oid  = d.objid   AND c.relname = 'dalali_listing_activity'
JOIN pg_class c2 ON c2.oid = d.refobjid AND c2.relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'auth'
);
-- Expected: 0

-- 2. Confirm all SECURITY DEFINER functions have set search_path
SELECT p.proname AS function_name,
       p.prosecdef AS is_security_definer,
       p.proconfig AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
WHERE p.prosecdef = true
  AND NOT (p.proconfig && ARRAY['search_path=public'])
ORDER BY p.proname;
-- Expected: 0 rows

-- 3. Confirm RLS status of all public tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;
-- Expected: rowsecurity = true for all rows
