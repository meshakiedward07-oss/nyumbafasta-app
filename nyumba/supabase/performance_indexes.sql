-- Performance indexes for NyumbaFasta — run in Supabase SQL editor.
-- These cover every hot query path: listing search, subscription checks,
-- webhook lookups, notifications, finance stats, and cron jobs.
-- All indexes are IF NOT EXISTS — safe to re-run.

-- ── Listings ─────────────────────────────────────────────────────────────────

-- Listing search (public browse) — filtered by status first (high cardinality reduction)
CREATE INDEX IF NOT EXISTS idx_listings_search
  ON listings(status, region, type, price_monthly);

-- Dalali's own listings (dashboard + slot count)
CREATE INDEX IF NOT EXISTS idx_listings_dalali_status
  ON listings(dalali_id, status);

-- Boosted listings expiry (cron job that clears expired boosts)
CREATE INDEX IF NOT EXISTS idx_listings_boosted
  ON listings(is_boosted, boosted_until) WHERE is_boosted = true;

-- ── Subscriptions ─────────────────────────────────────────────────────────────

-- Active subscription lookup (most-used check — plan gating, can-post, boost check)
CREATE INDEX IF NOT EXISTS idx_subscriptions_dalali_status
  ON subscriptions(dalali_id, status, expires_at);

-- Expiry cron — find subs expiring in the next N days
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_status
  ON subscriptions(expires_at, status) WHERE status = 'active';

-- ── Contact Unlocks ──────────────────────────────────────────────────────────

-- Client's unlocked listings (client dashboard)
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_client_status
  ON contact_unlocks(client_id, status);

-- Dalali's leads (dalali dashboard)
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_dalali_status
  ON contact_unlocks(dalali_id, status);

-- Income reporting by date
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_dalali_date
  ON contact_unlocks(dalali_id, created_at);

-- ── Notifications ─────────────────────────────────────────────────────────────

-- Per-user notification poll (unread badge count + notification list)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(user_id, is_read, created_at DESC);

-- ── Finance Tables ────────────────────────────────────────────────────────────

-- Monthly income stats (hesabu dashboard)
CREATE INDEX IF NOT EXISTS idx_dalali_income_dalali_date
  ON dalali_income(dalali_id, date);

-- Monthly expense stats
CREATE INDEX IF NOT EXISTS idx_dalali_expenses_dalali_date
  ON dalali_expenses(dalali_id, date);

-- ── Reviews ───────────────────────────────────────────────────────────────────

-- Listing reviews (listing detail page)
CREATE INDEX IF NOT EXISTS idx_reviews_listing
  ON reviews(listing_id, created_at DESC);

-- Dalali aggregate rating
CREATE INDEX IF NOT EXISTS idx_reviews_dalali
  ON reviews(dalali_id);

-- ── Payments (audit ledger) ───────────────────────────────────────────────────

-- Payments by type + date (admin revenue report)
CREATE INDEX IF NOT EXISTS idx_payments_type_date
  ON payments(type, created_at);

-- Dalali's payment history
CREATE INDEX IF NOT EXISTS idx_payments_dalali_type
  ON payments(dalali_id, type, status);

-- ── Boost Payments ────────────────────────────────────────────────────────────

-- Dalali's boost history
CREATE INDEX IF NOT EXISTS idx_boost_payments_dalali
  ON boost_payments(dalali_id, created_at DESC);

-- Listing's boost history
CREATE INDEX IF NOT EXISTS idx_boost_payments_listing
  ON boost_payments(listing_id);

-- ── Saved Listings ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_saved_listings_client
  ON saved_listings(client_id);

-- ── Dalali Profiles ───────────────────────────────────────────────────────────

-- Premium badge filter (listing browse dalali card)
CREATE INDEX IF NOT EXISTS idx_dalali_profiles_premium
  ON dalali_profiles(is_premium_verified) WHERE is_premium_verified = true;
