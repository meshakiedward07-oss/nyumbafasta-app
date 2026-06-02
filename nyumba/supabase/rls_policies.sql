-- RLS Policies for Nyumba App
-- Run in Supabase SQL Editor after fix_permissions.sql

-- ── listings ──────────────────────────────────────────────
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active listings
CREATE POLICY "listings_public_read" ON listings
  FOR SELECT USING (status = 'active');

-- Dalali can see their own listings (any status)
CREATE POLICY "listings_dalali_own" ON listings
  FOR SELECT USING (
    auth.uid() = dalali_id
  );

-- Dalali can insert their own listings
CREATE POLICY "listings_dalali_insert" ON listings
  FOR INSERT WITH CHECK (
    auth.uid() = dalali_id
  );

-- Dalali can update their own listings
CREATE POLICY "listings_dalali_update" ON listings
  FOR UPDATE USING (auth.uid() = dalali_id);

-- Admin can do everything
CREATE POLICY "listings_admin_all" ON listings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── users ─────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY "users_read_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own record
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Anyone can read basic user info (for dalali cards)
CREATE POLICY "users_public_basic" ON users
  FOR SELECT USING (true);

-- ── dalali_profiles ───────────────────────────────────────
ALTER TABLE dalali_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read dalali profiles
CREATE POLICY "dalali_profiles_public_read" ON dalali_profiles
  FOR SELECT USING (true);

-- Dalali can insert their own profile (needed for register flow via anon client)
CREATE POLICY "dalali_profiles_own_insert" ON dalali_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Dalali can update their own profile
CREATE POLICY "dalali_profiles_own_update" ON dalali_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ── contact_unlocks ───────────────────────────────────────
ALTER TABLE contact_unlocks ENABLE ROW LEVEL SECURITY;

-- Client can see their own unlocks
CREATE POLICY "unlocks_client_read" ON contact_unlocks
  FOR SELECT USING (auth.uid() = client_id);

-- Client can insert (initiate payment)
CREATE POLICY "unlocks_client_insert" ON contact_unlocks
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- ── saved_listings ────────────────────────────────────────
ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_own" ON saved_listings
  FOR ALL USING (auth.uid() = user_id);

-- ── reviews ───────────────────────────────────────────────
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_client_insert" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- ── subscriptions ─────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_own" ON subscriptions
  FOR SELECT USING (auth.uid() = dalali_id);

-- ── notifications ─────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);
