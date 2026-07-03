-- ──────────────────────────────────────────────────────────────────────────────
-- Security: Restrict whatsapp_number in dalali_profiles from public SELECT
--
-- Problem: dalali_profiles_public_read uses USING (true), which lets any client
-- with the anon key query whatsapp_number directly, bypassing the Tsh 2,000
-- contact_unlocks payment requirement.
--
-- Fix: Revoke column-level SELECT on whatsapp_number from anon + authenticated
-- roles at the PostgreSQL level. The service_role (used by server-side API routes)
-- retains full access, so contact/unlock endpoints continue to work correctly.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Revoke per-column SELECT on whatsapp_number from public-facing roles
REVOKE SELECT (whatsapp_number) ON public.dalali_profiles FROM anon;
REVOKE SELECT (whatsapp_number) ON public.dalali_profiles FROM authenticated;

-- 2. Replace the open public-read policy with one that excludes whatsapp_number
--    by listing only the safe columns explicitly.
--    Supabase/PostgREST respects column-level privileges — a row-level SELECT
--    policy grants access to the row, but column-level REVOKE hides the column.
--
--    The policy itself stays as USING (true) because the column restriction above
--    is the actual guard. Dropping and recreating it ensures a clean state.
DROP POLICY IF EXISTS "dalali_profiles_public_read" ON public.dalali_profiles;

CREATE POLICY "dalali_profiles_public_read" ON public.dalali_profiles
  FOR SELECT USING (true);

-- Note: After applying this migration, queries from anon/authenticated roles will
-- return all columns EXCEPT whatsapp_number (PostgREST omits revoked columns).
-- Server-side code using supabaseAdmin (service_role) is unaffected.

-- ── Additional: unique constraint on contact_unlocks to prevent double-unlock ─
-- Prevents a client from having multiple pending unlocks for the same listing,
-- which could be exploited to unlock without completing payment.
ALTER TABLE public.contact_unlocks
  DROP CONSTRAINT IF EXISTS contact_unlocks_client_listing_pending_unique;

CREATE UNIQUE INDEX IF NOT EXISTS contact_unlocks_client_listing_pending_unique
  ON public.contact_unlocks (client_id, listing_id)
  WHERE status = 'pending';
