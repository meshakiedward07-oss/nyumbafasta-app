-- ═══════════════════════════════════════════════════════════════════════════
-- security_hardening_2026_08_27.sql
-- Run in Supabase SQL Editor. Safe to re-run (REVOKE/GRANT are idempotent,
-- and every step is wrapped so a missing function/role is skipped, not fatal).
--
-- CONTEXT: three earlier attempts at this (advisor_revoke_2026_08_16.sql,
-- advisor_revoke_v2_2026_08_16.sql, security_hardening_2026_08_21.sql) were
-- written but — per the established pattern in this project — never
-- actually executed against the live database. Confirmed by the Supabase
-- database linter still reporting these exact functions as anon/authenticated
-- executable on 2026-08-27. This migration consolidates all three into one
-- final, correct version and is the one that should actually be run.
--
-- Priority items — genuinely exploitable right now, not just linter noise:
--   * start_dalali_trial(uuid) — any signed-in session (including an
--     anonymous guest session, since anonymous sign-ins are enabled for
--     guest browsing) can currently call
--     POST /rest/v1/rpc/start_dalali_trial {"dalali_user_id": "<any uuid>"}
--     directly and grant an Enterprise trial to any account.
--   * delete_user_account(uuid, text, uuid) — same exposure, and the
--     function itself (checked against fix_delete_user_account_2026_08_22.sql)
--     has ZERO internal authorization check — it will delete whichever
--     target_user_id it's given. Right now this is reachable by any
--     authenticated session, not just admins/service code. Every real call
--     site in the app (app/api/v1/account/delete, app/api/v1/admin/users/[id],
--     lib/dalali/accountMonitor.ts) already uses the service-role client —
--     no legitimate code path needs this open to `authenticated` at all.
--
-- Everything else here is standard advisor hardening: trigger-only functions
-- revoked entirely (never meant to be called via REST), and user-facing
-- SECURITY DEFINER functions scoped to `authenticated` instead of the
-- Supabase default of PUBLIC (which includes anon).
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;

  -- Group A: trigger/cron/maintenance functions — never called directly by
  -- any client. REVOKE FROM PUBLIC entirely, no re-grant to any client role.
  group_a TEXT[] := ARRAY[
    'handle_new_user',
    'guard_user_sensitive_columns',
    'nf_update_dalali_rating',
    'update_dalali_rating',
    'update_commission_status',
    'update_lead_quality',
    'update_transparent_agent',
    'send_trial_reminders',
    'nf_rate_limit_cleanup',
    'increment_keyword_matches',
    'update_listing_occupancy',
    'set_listing_taken',
    'auto_expire_listings',
    'process_lease_renewal',
    'compute_dalali_score',
    'mark_listing_expired',
    'set_is_active_on_insert',
    'sync_is_active_from_account_status',
    'check_report_rate_limit',
    'enforce_report_rate_limit',
    'nf_touch_chat_session'
  ];

  -- Group B: legitimate user-facing SECURITY DEFINER RPCs, called by signed-in
  -- users (including guests with an anonymous session) via supabase.rpc() or
  -- used inside RLS policies. Scope to `authenticated`, remove from PUBLIC
  -- (which silently includes anon).
  group_b TEXT[] := ARRAY[
    'get_my_role',
    'is_admin',
    'is_admin_or_staff',
    'has_active_subscription',
    'renew_listing',
    'increment_lead_count',
    'nf_cache_lookup',
    'nf_increment_cache_hit',
    'nf_kb_candidates',
    'nf_rate_limit_check',
    'nf_get_conversations'
  ];

  -- Group C: server-only functions. Every real call site uses the
  -- service-role client — no client-side code should ever reach these.
  -- Revoke from anon AND authenticated; service_role always bypasses grants.
  group_c TEXT[] := ARRAY[
    'start_dalali_trial',
    'delete_user_account',
    'nf_subscription_stats'
  ];

BEGIN
  -- ── Group A ────────────────────────────────────────────────────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = ANY(group_a)
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
      RAISE NOTICE 'A revoked: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'A skip: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  -- ── Group B ────────────────────────────────────────────────────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = ANY(group_b)
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
      RAISE NOTICE 'B scoped to authenticated: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'B skip: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  -- ── Group C — the urgent one ───────────────────────────────────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = ANY(group_c)
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
      EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
      RAISE NOTICE 'C locked to service_role: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'C skip: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  -- ── Group D: public counter RPCs — intentionally left open ─────────────
  -- increment_view_count, increment_share_count: anon visitors browsing
  -- listing pages / sharing before login must be able to call these.
  -- No action — this is why the linter will keep flagging them; accepted.

END $$;

DO $$ BEGIN
  RAISE NOTICE 'security_hardening_2026_08_27.sql complete.';
  RAISE NOTICE 'Verify with the query below that start_dalali_trial / delete_user_account are no longer authenticated-executable.';
END $$;

-- Verification: anon_can_execute / authenticated_can_execute must be FALSE
-- for start_dalali_trial and delete_user_account — only service_role_can_execute
-- should be TRUE.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('start_dalali_trial', 'delete_user_account', 'nf_subscription_stats');
