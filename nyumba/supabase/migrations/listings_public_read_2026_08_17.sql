-- listings_public_read_2026_08_17.sql
-- The listings table had only an admin-only policy (listings_admin_all).
-- Without a public SELECT policy, unauthenticated (anon) client-side queries
-- return zero rows even though the server-side fetch (service role) works fine.
-- This caused a phantom empty-state on the home page for guests.
--
-- Also adds a dalali-own policy so madalali can see their own listings
-- (any status) via direct client queries, e.g. quick-edit pages.
--
-- Safe to re-run: DROP POLICY IF EXISTS throughout.

-- ── 1. Public can see active, non-suspended listings ──────────────────────────
DROP POLICY IF EXISTS "listings_public_read" ON listings;
CREATE POLICY "listings_public_read" ON listings
  FOR SELECT
  USING (
    status = 'active'
    AND is_sub_suspended = false
  );

-- ── 2. Dalali can see all their own listings (any status) ─────────────────────
DROP POLICY IF EXISTS "listings_dalali_own" ON listings;
CREATE POLICY "listings_dalali_own" ON listings
  FOR SELECT
  USING (dalali_id = (SELECT auth.uid()));

DO $$ BEGIN
  RAISE NOTICE 'listings_public_read_2026_08_17.sql complete';
END $$;
