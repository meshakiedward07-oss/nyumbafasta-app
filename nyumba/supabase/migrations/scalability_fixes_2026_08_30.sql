-- ═══════════════════════════════════════════════════════════════════════════
-- scalability_fixes_2026_08_30.sql
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Found via a scalability audit (growth-shaped failure modes, distinct from
-- the raw-speed perf audit on 2026-08-27): app/api/v1/admin/analytics/
-- route.ts computed "revenue by region" by fetching up to 500
-- contact_unlocks rows (no date filter, no ORDER BY — so which 500 you get
-- is arbitrary) and summing them in JavaScript. Once completed unlocks
-- exceed 500 (plausible within months at Tsh 2,000/unlock, not years), the
-- figure silently becomes a partial, unstable sample instead of the true
-- all-time total — this migration replaces that with a real SQL aggregate
-- that scales correctly regardless of row count.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_unlock_revenue_by_region()
RETURNS TABLE(region TEXT, revenue NUMERIC, unlock_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(l.region, l.district, 'Nyingine') AS region,
    SUM(cu.amount_paid)::NUMERIC AS revenue,
    COUNT(*) AS unlock_count
  FROM contact_unlocks cu
  JOIN listings l ON l.id = cu.listing_id
  WHERE cu.status = 'completed'
  GROUP BY COALESCE(l.region, l.district, 'Nyingine')
  ORDER BY revenue DESC
  LIMIT 8;
$$;

-- Called only via the service-role client (app/api/v1/admin/analytics) —
-- same reasoning as every other admin-only aggregation RPC this session.
REVOKE EXECUTE ON FUNCTION public.get_unlock_revenue_by_region() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_unlock_revenue_by_region() TO service_role;

-- app/api/v1/admin/brokerage-commissions fetched the ENTIRE
-- brokerage_commissions table (no limit, no filter) on every single GET
-- request just to compute a handful of summary totals — this is the
-- worst-case shape of "reduce in JS" pattern from this audit: unlike the
-- ones above it wasn't giving wrong answers yet, but it re-scans the whole
-- table on every dashboard page load/refresh, getting linearly slower as
-- the table grows with zero caching in between. One SQL aggregate query
-- replaces it, scaling correctly regardless of row count.
CREATE OR REPLACE FUNCTION public.get_brokerage_commission_summary()
RETURNS TABLE(
  total_pending NUMERIC,
  total_invoiced NUMERIC,
  total_collected_month NUMERIC,
  overdue_count BIGINT,
  pending_count BIGINT,
  invoiced_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(calculated_amount) FILTER (WHERE collection_status = 'pending'), 0)::NUMERIC,
    COALESCE(SUM(calculated_amount) FILTER (WHERE collection_status = 'invoiced'), 0)::NUMERIC,
    COALESCE(SUM(calculated_amount) FILTER (
      WHERE collection_status = 'collected' AND collected_at >= date_trunc('month', now())
    ), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE collection_status = 'overdue'),
    COUNT(*) FILTER (WHERE collection_status = 'pending'),
    COUNT(*) FILTER (WHERE collection_status = 'invoiced')
  FROM brokerage_commissions;
$$;

REVOKE EXECUTE ON FUNCTION public.get_brokerage_commission_summary() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_brokerage_commission_summary() TO service_role;

DO $$ BEGIN
  RAISE NOTICE 'scalability_fixes_2026_08_30.sql complete.';
END $$;
