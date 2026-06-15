-- ============================================================
-- NyumbaFasta Performance Indexes
-- Run in Supabase SQL Editor (project > SQL Editor > New query)
-- CONCURRENTLY = no table lock, safe to run on live database
-- ============================================================

-- ─── listings ────────────────────────────────────────────────

-- Primary browse query: active listings ordered by boost + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_status_boosted_created
  ON listings (status, is_boosted DESC, created_at DESC)
  WHERE status = 'active';

-- Region filter (most common filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_region_status
  ON listings (region, status)
  WHERE status = 'active';

-- Type filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_type_status
  ON listings (type, status)
  WHERE status = 'active';

-- Price range filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_price
  ON listings (price_monthly)
  WHERE status = 'active';

-- Dalali's own listings (dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_dalali_created
  ON listings (dalali_id, created_at DESC);

-- Full-text search on title (ilike '%search%' queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_title_gin
  ON listings USING gin (to_tsvector('simple', coalesce(title, '')));

-- ─── users ───────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role
  ON users (role);

-- ─── contact_unlocks ─────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unlocks_client_status
  ON contact_unlocks (client_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unlocks_dalali_status
  ON contact_unlocks (dalali_id, status, created_at DESC);

-- ─── subscriptions ───────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_dalali_status
  ON subscriptions (dalali_id, status, expires_at DESC);

-- ─── reviews ─────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_dalali_created
  ON reviews (dalali_id, created_at DESC);

-- ─── whatsapp_sessions ───────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wa_sessions_phone_updated
  ON whatsapp_sessions (phone_number, updated_at DESC);

-- ─── social_posts ────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_status_created
  ON social_posts (status, created_at DESC);

-- ─── recently_viewed ─────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recently_viewed_user_viewed
  ON recently_viewed (user_id, viewed_at DESC);

-- ─── notifications ───────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);

-- ─── agent_leads ─────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_leads_status_created
  ON agent_leads (status, created_at DESC);
