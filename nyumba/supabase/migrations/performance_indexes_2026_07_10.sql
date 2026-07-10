-- ═══════════════════════════════════════════════════════════════════════════
-- NyumbaFasta — Performance Indexes Migration
-- Date: 2026-07-10
-- Run in Supabase SQL Editor (each statement is idempotent via IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── LISTINGS (most-queried table) ───────────────────────────────────────────

-- Primary browse filter: status + created_at (partial — only active rows)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_created
  ON listings(created_at DESC)
  WHERE status = 'active';

-- Boost ordering on browse page
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_boosted
  ON listings(is_boosted DESC, boosted_until DESC NULLS LAST, created_at DESC)
  WHERE status = 'active';

-- Region filter (most common spatial filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_region
  ON listings(region, created_at DESC)
  WHERE status = 'active';

-- Type filter (chumba, apartment, nyumba …)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_type
  ON listings(type, created_at DESC)
  WHERE status = 'active';

-- Region + type composite (browse page with both filters)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_region_type
  ON listings(region, type, created_at DESC)
  WHERE status = 'active';

-- Price range filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_active_price
  ON listings(price_monthly, created_at DESC)
  WHERE status = 'active';

-- Dalali's own listings (dashboard + owner check)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_dalali_status
  ON listings(dalali_id, status, created_at DESC);

-- Admin: listings by status (pending approval queue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_status_created
  ON listings(status, created_at DESC);

-- Marketplace sync: unposted active listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_marketplace_unposted
  ON listings(marketplace_posted, status, created_at DESC)
  WHERE status = 'active';

-- Occupancy listing type (for multi-unit listings)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_unit_type
  ON listings(listing_unit_type)
  WHERE listing_unit_type IS NOT NULL;

-- Full-text search (title + district + ward + mtaa)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_fts
  ON listings USING gin(
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(district, '') || ' ' ||
      coalesce(ward, '') || ' ' ||
      coalesce(mtaa, '') || ' ' ||
      coalesce(region, '')
    )
  )
  WHERE status = 'active';

-- ── USERS ───────────────────────────────────────────────────────────────────

-- Role filter (clients / dalali / admin tabs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created
  ON users(role, created_at DESC);

-- Active users (most common admin filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active
  ON users(role, is_active, created_at DESC)
  WHERE is_active = true;

-- Username lookup (profile pages, duplicate check)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username
  ON users(username)
  WHERE username IS NOT NULL;

-- Phone lookup (WhatsApp matching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_phone
  ON users(phone)
  WHERE phone IS NOT NULL;

-- ── DALALI_PROFILES ─────────────────────────────────────────────────────────

-- Verification queue
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_profiles_verification_status
  ON dalali_profiles(verification_status, created_at DESC);

-- Premium/verified badge filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_profiles_premium
  ON dalali_profiles(is_premium_verified)
  WHERE is_premium_verified = true;

-- Favourite dalali badge
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_profiles_favourite
  ON dalali_profiles(is_favourite_dalali)
  WHERE is_favourite_dalali = true;

-- Rating sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_profiles_rating
  ON dalali_profiles(rating_avg DESC)
  WHERE rating_avg IS NOT NULL;

-- WhatsApp number lookup (broadcast count)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_profiles_whatsapp
  ON dalali_profiles(whatsapp_number)
  WHERE whatsapp_number IS NOT NULL;

-- ── SUBSCRIPTIONS ───────────────────────────────────────────────────────────

-- Per-dalali active subscription (listing limit check — called on every POST)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_dalali_status
  ON subscriptions(dalali_id, status, expires_at DESC);

-- Expiry monitoring (cron job)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_status_expires
  ON subscriptions(status, expires_at)
  WHERE status IN ('active', 'grace_period', 'trial');

-- ── CONTACT_UNLOCKS ─────────────────────────────────────────────────────────

-- Client's unlock history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_unlocks_client
  ON contact_unlocks(client_id, created_at DESC);

-- Dalali's received unlocks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_unlocks_dalali
  ON contact_unlocks(dalali_id, created_at DESC);

-- Payment status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_unlocks_status
  ON contact_unlocks(payment_status, created_at DESC);

-- ── NOTIFICATIONS ───────────────────────────────────────────────────────────

-- Unread count (called on every page load)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false;

-- Full list including read
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- ── SAVED_LISTINGS ──────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_listings_client
  ON saved_listings(client_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_listings_listing
  ON saved_listings(listing_id);

-- ── REVIEWS ─────────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_dalali_created
  ON reviews(dalali_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_listing
  ON reviews(listing_id, created_at DESC);

-- ── CHAT SESSIONS ───────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_phone_platform
  ON chat_sessions(phone, platform);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_updated
  ON chat_sessions(updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_sessions_status
  ON chat_sessions(status, updated_at DESC)
  WHERE status IN ('open', 'escalated', 'takeover');

-- ── CHAT MESSAGES ───────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at DESC);

-- ── DALALI INCOME (finance dashboard) ───────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_income_dalali_date
  ON dalali_income(dalali_id, date DESC);

-- Monthly aggregation (finance stats — current hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_income_dalali_month
  ON dalali_income(dalali_id, date)
  WHERE date >= (CURRENT_DATE - INTERVAL '1 year');

-- ── DALALI EXPENSES ─────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_expenses_dalali_date
  ON dalali_expenses(dalali_id, date DESC);

-- ── DALALI COMMISSIONS ──────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_commissions_dalali_status
  ON dalali_commissions(dalali_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_commissions_overdue
  ON dalali_commissions(due_date, status)
  WHERE status IN ('pending', 'overdue');

-- ── DALALI GOALS ────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dalali_goals_dalali_period
  ON dalali_goals(dalali_id, year, month);

-- ── MARKETPLACE LISTINGS ────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_listings_listing
  ON marketplace_listings(listing_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_listings_retailer
  ON marketplace_listings(retailer_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_listings_status
  ON marketplace_listings(status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_marketplace_listings_expiry
  ON marketplace_listings(expires_at, status)
  WHERE status = 'active';

-- ── SOCIAL POSTS ────────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_platform_created
  ON social_posts(platform, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_listing
  ON social_posts(listing_id)
  WHERE listing_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_social_posts_status
  ON social_posts(status, created_at DESC);

-- ── VIDEO UPLOADS ───────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_uploads_status
  ON video_uploads(post_status, created_at DESC);

-- ── PROFILE VIEWS (analytics hot path) ─────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_views_dalali_date
  ON profile_views(dalali_id, created_at DESC);

-- ── PROFILE CLICK EVENTS ────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_click_events_dalali
  ON profile_click_events(dalali_id, created_at DESC);

-- ── FB POSTING GROUPS ───────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fb_posting_groups_active
  ON fb_posting_groups(is_active, created_at DESC);

-- ── FB GROUP POSTS ──────────────────────────────────────────────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fb_group_posts_listing
  ON facebook_group_posts(listing_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fb_group_posts_group
  ON facebook_group_posts(group_id, created_at DESC);

-- ── ANALYZE ALL TABLES ──────────────────────────────────────────────────────
-- Updates planner statistics so the new indexes are used immediately

ANALYZE listings;
ANALYZE users;
ANALYZE dalali_profiles;
ANALYZE subscriptions;
ANALYZE contact_unlocks;
ANALYZE notifications;
ANALYZE saved_listings;
ANALYZE reviews;
ANALYZE marketplace_listings;

-- ── VERIFY INDEXES CREATED ──────────────────────────────────────────────────
SELECT
  tablename,
  COUNT(*) AS index_count,
  array_agg(indexname ORDER BY indexname) AS indexes
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
GROUP BY tablename
ORDER BY tablename;
