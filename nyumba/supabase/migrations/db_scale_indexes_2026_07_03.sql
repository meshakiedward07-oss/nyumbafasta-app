-- ════════════════════════════════════════════════════════════════════════════
-- Scale Optimization: Indexes + FTS for 1M+ users / 10M+ listings
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run — all statements use IF NOT EXISTS or DO $$ guards
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Extensions ────────────────────────────────────────────────────────────
-- pg_trgm: enables ILIKE index (GIN trigram) so %search% queries hit an index
-- pg_stat_statements: tracks slow queries — required for Query Performance tab
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ── 1. Listings — core browse index ──────────────────────────────────────────
-- Covers: status filter + order by is_boosted + created_at (the home page query)
CREATE INDEX IF NOT EXISTS idx_listings_browse
  ON listings (status, is_boosted DESC, created_at DESC)
  WHERE status = 'active';

-- Region + status filter (most common filter combo)
CREATE INDEX IF NOT EXISTS idx_listings_region_status
  ON listings (region, status, created_at DESC)
  WHERE status = 'active';

-- Type + status filter
CREATE INDEX IF NOT EXISTS idx_listings_type_status
  ON listings (type, status, created_at DESC)
  WHERE status = 'active';

-- Price range filter on active listings
CREATE INDEX IF NOT EXISTS idx_listings_price_active
  ON listings (price_monthly, status)
  WHERE status = 'active';

-- Dalali's own listings (dashboard, edit page)
CREATE INDEX IF NOT EXISTS idx_listings_dalali_status
  ON listings (dalali_id, status, created_at DESC);

-- Boost expiry — used by the hourly cron to deactivate expired boosts
CREATE INDEX IF NOT EXISTS idx_listings_boosted_until
  ON listings (boosted_until)
  WHERE is_boosted = true;

-- ── 2. Full-Text Search on listings ──────────────────────────────────────────
-- Add tsvector column for FTS (if it doesn't exist yet)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(title, '') || ' ' ||
      coalesce(district, '') || ' ' ||
      coalesce(region, '') || ' ' ||
      coalesce(ward, '') || ' ' ||
      coalesce(mtaa, '') || ' ' ||
      coalesce(description, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_listings_fts
  ON listings USING gin(search_vector);

-- GIN trigram index for ILIKE '%search%' queries (fallback when FTS is too strict)
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON listings USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_listings_district_trgm
  ON listings USING gin(district gin_trgm_ops);

-- ── 3. Contact unlocks — payment lookup ───────────────────────────────────────
-- Used in the /contact endpoint: client_id + listing_id + status = 'completed'
CREATE INDEX IF NOT EXISTS idx_unlocks_client_listing
  ON contact_unlocks (client_id, listing_id, status);

-- Subscription expiry check (recurring cron + subscription initiate)
CREATE INDEX IF NOT EXISTS idx_unlocks_status_reminder
  ON contact_unlocks (status, reminder_sent_at)
  WHERE status = 'completed';

-- ── 4. Subscriptions ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_dalali_active
  ON subscriptions (dalali_id, status, expires_at DESC)
  WHERE status IN ('active', 'grace_period');

-- ── 5. Users ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users (phone)
  WHERE phone IS NOT NULL;

-- ── 6. Saved listings ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saved_listings_client
  ON saved_listings (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_listings_listing
  ON saved_listings (listing_id);

-- ── 7. Notifications ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- ── 8. Reviews ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reviews_listing
  ON reviews (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer
  ON reviews (reviewer_id, created_at DESC);

-- ── 9. WhatsApp messages ──────────────────────────────────────────────────────
-- Covers the sessions enrichment query (phone_number + created_at DESC)
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created
  ON whatsapp_messages (phone_number, created_at DESC);

-- Unread inbound count per phone
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_direction
  ON whatsapp_messages (phone_number, direction)
  WHERE direction = 'inbound';

-- ── 10. Social posts ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_social_posts_listing
  ON social_posts (listing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_status
  ON social_posts (status, created_at DESC);

-- ── 11. Dalali profiles ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dalali_profiles_verified
  ON dalali_profiles (is_premium_verified)
  WHERE is_premium_verified = true;

-- ── 12. Update planner statistics ────────────────────────────────────────────
-- Forces PostgreSQL to recalculate table stats so the query planner uses new indexes
ANALYZE listings;
ANALYZE contact_unlocks;
ANALYZE subscriptions;
ANALYZE users;
ANALYZE saved_listings;
ANALYZE notifications;
ANALYZE reviews;
