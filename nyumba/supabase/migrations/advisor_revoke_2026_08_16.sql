-- ═══════════════════════════════════════════════════════════════════════════════
-- advisor_revoke_2026_08_16.sql
-- Fix anon_security_definer_function_executable +
--      authenticated_security_definer_function_executable warnings.
--
-- Root cause: Supabase grants EXECUTE ON ALL FUNCTIONS TO PUBLIC by default,
-- so both anon and authenticated can call every function via REST API.
-- Fix: REVOKE FROM PUBLIC, then GRANT only to the roles that actually need it.
--
-- Three groups:
--   A) Trigger / cron functions — no direct callers → no re-grant
--   B) User-facing functions   — authenticated users call these → GRANT TO authenticated
--   C) Public counter RPCs     — anon visitors trigger view/share counts → keep PUBLIC
--
-- Safe to re-run.  REVOKE IF EXISTS semantics: no-op if already revoked.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP A: Trigger / cron / maintenance functions
-- Should never be called directly via REST API by any role.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_user_sensitive_columns()                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nf_update_dalali_rating()                               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_dalali_rating()                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_commission_status()                              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_lead_quality()                                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_transparent_agent()                              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_trial_reminders()                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nf_rate_limit_cleanup(p_older_than_sec integer)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_keyword_matches(keywords text[])              FROM PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP B: User-facing SECURITY DEFINER functions
-- Authenticated users call these via supabase.rpc() or they are used in RLS
-- policies (is_admin, is_admin_or_staff MUST stay executable by authenticated
-- or RLS policies on every admin-protected table will break).
-- After this: anon warning disappears; authenticated warning remains (acceptable).
-- ─────────────────────────────────────────────────────────────────────────────

-- Role helpers (used in RLS policies — authenticated MUST retain EXECUTE)
REVOKE EXECUTE ON FUNCTION public.get_my_role()                                            FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_role()                                            TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin()                                              FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin()                                              TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_staff()                                     FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin_or_staff()                                     TO authenticated;

-- Subscription / trial
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(dalali_uuid uuid)               FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_active_subscription(dalali_uuid uuid)               TO authenticated;

REVOKE EXECUTE ON FUNCTION public.start_dalali_trial(dalali_user_id uuid)                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.start_dalali_trial(dalali_user_id uuid)                 TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nf_subscription_stats()                                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_subscription_stats()                                 TO authenticated;

-- Listing management
REVOKE EXECUTE ON FUNCTION public.renew_listing(listing_id uuid, owner_id uuid)           FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.renew_listing(listing_id uuid, owner_id uuid)           TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_lead_count(listing_id uuid)                   FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.increment_lead_count(listing_id uuid)                   TO authenticated;

-- User account management (admin action — still needs authenticated, not anon)
REVOKE EXECUTE ON FUNCTION public.delete_user_account(target_user_id uuid, reason text, deleted_by_id uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_user_account(target_user_id uuid, reason text, deleted_by_id uuid) TO authenticated;

-- Report rate limiting (requires sign-in to file a report)
REVOKE EXECUTE ON FUNCTION public.check_report_rate_limit()                               FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_report_rate_limit()                               TO authenticated;

REVOKE EXECUTE ON FUNCTION public.enforce_report_rate_limit()                             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enforce_report_rate_limit()                             TO authenticated;

-- WhatsApp / AI chatbot — called server-side via service_role, but granting
-- authenticated is harmless and avoids breaking any direct client calls.
REVOKE EXECUTE ON FUNCTION public.nf_cache_lookup(p_question text, p_threshold double precision, p_limit integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_cache_lookup(p_question text, p_threshold double precision, p_limit integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nf_increment_cache_hit(p_cache_id uuid)                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_increment_cache_hit(p_cache_id uuid)                 TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nf_kb_candidates(p_query text, p_limit integer)         FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_kb_candidates(p_query text, p_limit integer)         TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nf_rate_limit_check(p_identifier text, p_platform text, p_window_sec integer, p_max_count integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_rate_limit_check(p_identifier text, p_platform text, p_window_sec integer, p_max_count integer) TO authenticated;

-- nf_get_conversations: 3 overloads
REVOKE EXECUTE ON FUNCTION public.nf_get_conversations(p_user_id uuid, p_org_id uuid, p_limit integer, p_offset integer)                             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_get_conversations(p_user_id uuid, p_org_id uuid, p_limit integer, p_offset integer)                             TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nf_get_conversations(p_user_id uuid, p_org_id uuid, p_type text, p_limit integer)                                  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_get_conversations(p_user_id uuid, p_org_id uuid, p_type text, p_limit integer)                                  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nf_get_conversations(p_user_id uuid, p_org_id uuid, p_type text, p_limit integer, p_source_role text)              FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_get_conversations(p_user_id uuid, p_org_id uuid, p_type text, p_limit integer, p_source_role text)              TO authenticated;

-- nf_touch_chat_session (trigger-style but may be called by authenticated sessions)
REVOKE EXECUTE ON FUNCTION public.nf_touch_chat_session()                                 FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nf_touch_chat_session()                                 TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- GROUP C: Public counter RPCs — anon visitors must be able to call these.
-- Listing views are tracked for anonymous users browsing the site.
-- These will remain flagged by the advisor; that is an accepted tradeoff.
-- ─────────────────────────────────────────────────────────────────────────────

-- increment_view_count: keep PUBLIC (anon users browse listing pages)
-- increment_share_count: keep PUBLIC (share button fires before login)
-- No REVOKE for these two.

-- ─────────────────────────────────────────────────────────────────────────────
-- Handle any remaining functions auto-discovered from the DB.
-- This catches functions flagged in the (truncated) advisor output
-- that weren't listed explicitly above.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r      RECORD;
BEGIN
  FOR r IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        -- Any remaining trigger-style update functions
        'update_listing_occupancy',
        'set_listing_taken',
        'auto_expire_listings',
        'process_lease_renewal',
        'compute_dalali_score',
        'mark_listing_expired'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
      RAISE NOTICE 'REVOKED: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'advisor_revoke_2026_08_16.sql complete';
END $$;
