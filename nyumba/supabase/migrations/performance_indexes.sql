-- ============================================================
-- NyumbaFasta Performance Indexes
-- Run in Supabase SQL Editor (project > SQL Editor > New query)
-- Note: CONCURRENTLY removed — SQL Editor runs inside a transaction
-- ============================================================

-- ─── listings ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_listings_status_boosted_created
  ON listings (status, is_boosted DESC, created_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_region_status
  ON listings (region, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_type_status
  ON listings (type, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_price
  ON listings (price_monthly)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_dalali_created
  ON listings (dalali_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_title_gin
  ON listings USING gin (to_tsvector('simple', coalesce(title, '')));

-- ─── users ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

-- ─── contact_unlocks ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_unlocks_client_status
  ON contact_unlocks (client_id, status);

CREATE INDEX IF NOT EXISTS idx_unlocks_dalali_status
  ON contact_unlocks (dalali_id, status, created_at DESC);

-- ─── subscriptions ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_dalali_status
  ON subscriptions (dalali_id, status, expires_at DESC);

-- ─── reviews ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reviews_dalali_created
  ON reviews (dalali_id, created_at DESC);

-- ─── whatsapp_sessions ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wa_sessions_phone_updated
  ON whatsapp_sessions (phone_number, updated_at DESC);

-- ─── social_posts ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_social_posts_status_created
  ON social_posts (status, created_at DESC);

-- ─── recently_viewed ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_viewed
  ON recently_viewed (user_id, viewed_at DESC);

-- ─── notifications ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);

-- ─── agent_leads ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_agent_leads_status_created
  ON agent_leads (status, created_at DESC);
