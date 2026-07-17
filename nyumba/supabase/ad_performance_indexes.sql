-- ═══════════════════════════════════════════════════════════════════════════════
-- Ad System Performance Indexes — run once, safe on live DB (CONCURRENTLY)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. PRIMARY ranking index ─────────────────────────────────────────────────
-- Covers the main rankAds() query:
--   WHERE status = 'active' AND payment_status = 'completed'
--   AND target_region = $1
-- PostgreSQL uses this partial index for both the candidate fetch AND count.
-- Without this, every ranking call does a sequential scan of all campaigns.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_active_ranking
  ON ad_campaigns (target_region, ad_type, target_category, expires_at)
  WHERE status = 'active' AND payment_status = 'completed';

-- ── 2. Ad type filter index (for /directory and type-specific placements) ────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_active_type
  ON ad_campaigns (ad_type, target_region, expires_at)
  WHERE status = 'active' AND payment_status = 'completed';

-- ── 3. Admin queue index ─────────────────────────────────────────────────────
-- Covers: WHERE status IN (...) ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_status_created
  ON ad_campaigns (status, created_at DESC);

-- ── 4. Advertiser dashboard index ───────────────────────────────────────────
-- Covers: WHERE advertiser_id = $1 ORDER BY created_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_advertiser_created
  ON ad_campaigns (advertiser_id, created_at DESC);

-- ── 5. Slot availability check ───────────────────────────────────────────────
-- Covers: COUNT(*) WHERE advertiser_id = ? AND status IN ('active','approved','pending_review')
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_campaigns_advertiser_status
  ON ad_campaigns (advertiser_id, status)
  WHERE status IN ('active', 'approved', 'pending_review');

-- ── 6. Waiting list lookup ───────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_waiting_list_type_status
  ON ad_waiting_list (ad_type, status, created_at ASC)
  WHERE status = 'waiting';

-- ── 7. ad_impressions: fast purge by age ─────────────────────────────────────
-- The existing composite index (session_id, shown_at DESC) is good for lookups.
-- This standalone index enables: DELETE WHERE shown_at < $cutoff
-- Without it, the daily cron DELETE scans the entire table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_impressions_shown_at
  ON ad_impressions (shown_at);

-- ── 8. ad_payments: webhook lookup ───────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_payments_external_id
  ON ad_payments (external_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ad_payments_campaign_status
  ON ad_payments (campaign_id, status, created_at DESC);

-- ── Summary ──────────────────────────────────────────────────────────────────
-- Index 1: reduces ranking query from O(n) → O(log n) + index scan
-- Index 7: reduces daily impression purge from O(n) → O(k) where k = expired rows
-- All indexes are partial where possible (smaller, faster, less write overhead)
