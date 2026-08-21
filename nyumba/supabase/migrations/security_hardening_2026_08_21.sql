-- ═══════════════════════════════════════════════════════════════════════════
-- security_hardening_2026_08_21.sql
-- Fixes Supabase security linter warnings.
-- Run ONCE in Supabase SQL Editor. Safe to re-run (REVOKE/GRANT are idempotent).
--
-- What this fixes:
--   1. Trigger-only functions exposed via REST — revoke from anon + authenticated
--   2. Server-side-only functions reachable by any authenticated user — restrict to service_role
--   3. next_dalali_invoice_number — mutable search_path
--
-- What is NOT changed (intentional design):
--   - increment_view_count, increment_share_count  — anon-callable by design (listing counters)
--   - is_admin, is_admin_or_staff, get_my_role     — RLS helpers, must stay accessible
--   - has_active_subscription, renew_listing        — called by dalali client-side
--   - nf_get_conversations, nf_cache_lookup, etc.   — Amina AI, server-side via service_role
--
-- auth_leaked_password_protection: enable in Supabase Dashboard → Auth → Password Security
-- pg_trgm in public schema: low risk, leave as-is (Supabase manages extension placement)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Trigger functions — revoke REST access from anon + authenticated ───────
-- These are called by PostgreSQL triggers, never by client code.
-- Exposing them via /rest/v1/rpc/ is unintentional.

REVOKE EXECUTE ON FUNCTION public.set_is_active_on_insert()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_is_active_from_account_status()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_dalali_rating()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_report_rate_limit()             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_report_rate_limit()           FROM anon, authenticated;


-- ── 2. Server-side-only functions — restrict to service_role ─────────────────
-- All callers use adminClient (service_role key). No client should ever call
-- these directly — the REST exposure allows privilege escalation attacks.

-- start_dalali_trial: any authenticated user could give themselves/others a free trial
REVOKE EXECUTE ON FUNCTION public.start_dalali_trial(uuid) FROM authenticated;
-- Keep service_role (already granted):
GRANT  EXECUTE ON FUNCTION public.start_dalali_trial(uuid) TO service_role;

-- delete_user_account: any authenticated user could attempt to delete accounts.
-- The function has an internal admin check, but belt-and-suspenders.
REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid, text, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_account(uuid, text, uuid) TO service_role;

-- nf_subscription_stats: internal admin analytics — no client needs to call this
REVOKE EXECUTE ON FUNCTION public.nf_subscription_stats() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.nf_subscription_stats() TO service_role;


-- ── 3. Fix mutable search_path on next_dalali_invoice_number ─────────────────
-- Without SET search_path, a superuser could exploit search_path injection.
-- We re-create the function body with SET search_path = public added.
-- (Replace the body below if the actual function body differs in your DB)

CREATE OR REPLACE FUNCTION public.next_dalali_invoice_number(p_dalali_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INT)), 0) + 1
    INTO v_count
    FROM dalali_invoices
   WHERE dalali_id = p_dalali_id;
  RETURN 'INV-' || LPAD(v_count::TEXT, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_dalali_invoice_number(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.next_dalali_invoice_number(uuid) FROM anon, authenticated;


DO $$ BEGIN
  RAISE NOTICE 'security_hardening_2026_08_21.sql complete.';
  RAISE NOTICE 'Remaining manual step: enable Leaked Password Protection in Supabase Dashboard → Auth → Password Security.';
END $$;
