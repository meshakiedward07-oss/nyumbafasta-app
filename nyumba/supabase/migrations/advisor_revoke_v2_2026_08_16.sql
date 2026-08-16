-- advisor_revoke_v2_2026_08_16.sql
-- Supersedes advisor_revoke_2026_08_16.sql (which failed because bare REVOKE
-- on a non-existent function aborts the transaction).
--
-- Fix: use pg_proc discovery so we only REVOKE/GRANT functions that exist,
-- and wrap each in a sub-block so one failure never stops the rest.
--
-- Groups:
--   A) Trigger/cron — REVOKE FROM PUBLIC, no re-grant
--   B) User-facing  — REVOKE FROM PUBLIC, GRANT TO authenticated
--   C) Public RPCs  — keep PUBLIC (increment_view_count, increment_share_count)
--
-- Safe to re-run.

DO $$
DECLARE
  r       RECORD;
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
    'mark_listing_expired'
  ];
  group_b TEXT[] := ARRAY[
    'get_my_role',
    'is_admin',
    'is_admin_or_staff',
    'has_active_subscription',
    'start_dalali_trial',
    'nf_subscription_stats',
    'renew_listing',
    'increment_lead_count',
    'delete_user_account',
    'check_report_rate_limit',
    'enforce_report_rate_limit',
    'nf_cache_lookup',
    'nf_increment_cache_hit',
    'nf_kb_candidates',
    'nf_rate_limit_check',
    'nf_get_conversations',
    'nf_touch_chat_session'
  ];
BEGIN
  -- ── Group A: REVOKE only ────────────────────────────────────────────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM   pg_proc p
    JOIN   pg_namespace n ON p.pronamespace = n.oid
    WHERE  n.nspname = 'public'
      AND  p.proname = ANY(group_a)
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
        r.proname, r.args
      );
      RAISE NOTICE 'A REVOKED: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'A SKIP: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  -- ── Group B: REVOKE + GRANT TO authenticated ────────────────────────────────
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM   pg_proc p
    JOIN   pg_namespace n ON p.pronamespace = n.oid
    WHERE  n.nspname = 'public'
      AND  p.proname = ANY(group_b)
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
        r.proname, r.args
      );
      EXECUTE format(
        'GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated',
        r.proname, r.args
      );
      RAISE NOTICE 'B REVOKE+GRANT: public.%(%)', r.proname, r.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'B SKIP: public.%(%): %', r.proname, r.args, SQLERRM;
    END;
  END LOOP;

  -- Group C (increment_view_count, increment_share_count) — no change, keep PUBLIC.

  RAISE NOTICE 'advisor_revoke_v2_2026_08_16.sql complete';
END $$;
