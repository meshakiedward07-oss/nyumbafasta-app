-- ═══════════════════════════════════════════════════════════════════════════════
-- advisor_remaining_2026_08_16.sql
-- Fix remaining Supabase Advisor warnings after RLS policies were fixed:
--   1. function_search_path_mutable  — 28+ functions
--   2. anon_security_definer_function_executable — REVOKE anon EXECUTE
--   3. rls_policy_always_true        — system_insert_occupancy_log
--   4. public_bucket_allows_listing  — listing-videos, listings buckets
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: function_search_path_mutable
-- Use pg_proc to auto-discover exact argument signatures so we don't need to
-- hardcode them. Handles all overloads of nf_get_conversations automatically.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r      RECORD;
  fn_sql TEXT;
BEGIN
  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'inc_lead_count',
        'get_my_role',
        'has_active_subscription',
        'renew_listing',
        'update_agent_leads_updated_at',
        'update_video_uploads_updated_at',
        'update_updated_at',
        'upsert_spam_account',
        'check_listing_capacity',
        'link_lead_on_registration',
        'detect_first_listing',
        'increment_contact_attempts',
        'update_dalali_last_listing',
        'get_monthly_expenses',
        'generate_location_display',
        'update_brokerage_requests_updated_at',
        'set_updated_at_fundi_plans',
        'set_updated_at_fundi_subs',
        'nf_increment_cache_hit',
        'nf_kb_candidates',
        'nf_cache_lookup',
        'nf_rate_limit_check',
        'nf_rate_limit_cleanup',
        'nf_get_conversations',
        'nf_touch_chat_session',
        'next_dalali_invoice_number',
        'set_updated_at',
        'touch_updated_at',
        -- Extra ones that may be flagged (add any from truncated list)
        'nf_update_dalali_session',
        'nf_update_chat_session',
        'update_listing_status',
        'update_profile_completeness'
      )
  LOOP
    fn_sql := format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public',
      r.proname, r.args
    );
    BEGIN
      EXECUTE fn_sql;
      RAISE NOTICE 'FIXED search_path: public.%(%) ', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: anon_security_definer_function_executable
-- REVOKE EXECUTE from anon for internal / admin-only SECURITY DEFINER functions.
-- Keep anon EXECUTE ONLY for functions that public (unauthenticated) users call:
--   increment_view_count   — anon users browse listing pages
--   increment_share_count  — anon users can share
-- Everything else: anon should not call directly.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r      RECORD;
  fn_sql TEXT;
BEGIN
  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        -- Auth / user management (never anon-callable)
        'delete_user_account',
        'guard_user_sensitive_columns',
        'handle_new_user',
        -- Role helpers (safe to restrict — returns false for anon anyway)
        'get_my_role',
        'is_admin',
        'is_admin_or_staff',
        -- Subscription helpers (server-side only)
        'has_active_subscription',
        'nf_subscription_stats',
        -- Report rate limiting (require auth)
        'check_report_rate_limit',
        'enforce_report_rate_limit',
        -- Spam / keyword functions (internal server-side)
        'increment_keyword_matches',
        -- Analytics for logged-in flows (client pays → must be authed)
        'increment_lead_count',
        -- WhatsApp / chatbot (all server-side with service role)
        'nf_cache_lookup',
        'nf_increment_cache_hit',
        'nf_kb_candidates',
        'nf_rate_limit_check',
        'nf_rate_limit_cleanup',
        'nf_get_conversations',
        'nf_touch_chat_session',
        'nf_update_dalali_session',
        'nf_update_chat_session'
      )
  LOOP
    fn_sql := format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
      r.proname, r.args
    );
    BEGIN
      EXECUTE fn_sql;
      RAISE NOTICE 'REVOKED anon EXECUTE: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP revoke: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: rls_policy_always_true
-- Fix system_insert_occupancy_log on listing_occupancy_log.
-- Currently has WITH CHECK (true) — restrict to trigger context (no direct inserts
-- from clients). The table is written to ONLY by the check_listing_capacity trigger.
-- Best fix: restrict to service role or authenticated users who own the listing.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "system_insert_occupancy_log" ON listing_occupancy_log;
CREATE POLICY "system_insert_occupancy_log" ON listing_occupancy_log
  FOR INSERT
  WITH CHECK (
    -- Trigger fires as the session user; changers are admins or the dalali
    -- who owns the listing being updated.
    EXISTS (
      SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'staff')
    )
    OR EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_occupancy_log.listing_id
        AND dalali_id = (SELECT auth.uid())
    )
    OR (SELECT auth.uid()) IS NULL  -- service role (supabaseAdmin) triggers
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: public_bucket_allows_listing
-- The broad SELECT policies on storage.objects for listing-videos and listings
-- buckets let any client enumerate all files. Narrow them to object-path access
-- only by removing the policies — public buckets already allow object URL reads
-- without a SELECT policy; listing via the Storage API requires one.
-- ─────────────────────────────────────────────────────────────────────────────

-- listing-videos bucket: drop the two broad SELECT policies
DROP POLICY IF EXISTS "Public can view listing videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read listing videos"     ON storage.objects;

-- listings image bucket: drop the broad SELECT policy
DROP POLICY IF EXISTS "listings_bucket_public_read" ON storage.objects;

-- Re-create narrow SELECT policies that allow object download by URL but
-- NOT listing (enumerate) the bucket contents.
-- Supabase public buckets serve GET /object/public/{bucket}/{path} without
-- any policy; these policies only affect Storage API listing calls.
-- Leaving them dropped effectively disables bucket listing while keeping
-- object URL access intact.

-- If your app needs to list files in these buckets, restrict to authenticated:
-- CREATE POLICY "authenticated_list_listing_videos" ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'listing-videos');
-- CREATE POLICY "authenticated_list_listings" ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'listings');

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: extension_in_public (pg_trgm) is intentionally skipped.
-- Moving an extension schema requires dropping and recreating all dependent
-- objects (indexes, functions). The risk outweighs the advisory warning.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  RAISE NOTICE 'advisor_remaining_2026_08_16.sql complete';
END $$;
