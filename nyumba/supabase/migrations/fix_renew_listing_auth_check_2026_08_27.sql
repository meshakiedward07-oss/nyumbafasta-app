-- ═══════════════════════════════════════════════════════════════════════════
-- fix_renew_listing_auth_check_2026_08_27.sql
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Found while auditing SECURITY DEFINER function bodies directly (the
-- Supabase linter doesn't check this — it only flags that the function is
-- callable, not whether its internal logic is sound).
--
-- renew_listing(listing_id, owner_id) checks that `listing_id` belongs to
-- `owner_id`, but never checks that the CALLER actually IS `owner_id`
-- (auth.uid()). Both listing_id and its owning dalali's user id are visible
-- on the public listing page, so any authenticated (including anonymous
-- guest) session could call:
--   POST /rest/v1/rpc/renew_listing {"listing_id": "<any>", "owner_id": "<that listing's real dalali id>"}
-- and force someone else's listing back to status='active' with a fresh
-- 90-day expiry and reset renewal_count/expiry_reminded_at — without that
-- dalali's consent. Confirmed via grep that the app's own caller
-- (components/dalali/MyListingsClient.tsx) always passes owner_id from the
-- CALLER's own session (`user?.id`), so this check is purely additive and
-- changes nothing for legitimate use.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.renew_listing(listing_id uuid, owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS DISTINCT FROM owner_id THEN
    RAISE EXCEPTION 'Huna ruhusa ya kuhuisha listing hii';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM listings
    WHERE id = listing_id AND dalali_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Huna ruhusa ya kuhuisha listing hii';
  END IF;

  UPDATE listings SET
    expires_at = now() + interval '90 days',
    renewed_at = now(),
    renewal_count = renewal_count + 1,
    status = 'active',
    expiry_reminded_at = NULL
  WHERE id = listing_id AND dalali_id = owner_id;
END;
$function$;

DO $$ BEGIN
  RAISE NOTICE 'fix_renew_listing_auth_check_2026_08_27.sql complete — renew_listing now verifies auth.uid() = owner_id.';
END $$;
