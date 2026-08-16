-- influencer_phase2_2026_08_16.sql
-- Phase 2: Influencer role and permission boundary
--
-- A staff user with a row in influencer_profiles is treated as an influencer
-- (external partner, not an employee). This table is the single source of truth
-- for influencer identity and referral code. Referral tracking and payout ledger
-- are added in later phases.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS throughout

-- ── Influencer profiles table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS influencer_profiles (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT         NOT NULL UNIQUE,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  social_handle TEXT,
  platform      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_influencer_profiles_user ON influencer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_code ON influencer_profiles(referral_code);

ALTER TABLE influencer_profiles ENABLE ROW LEVEL SECURITY;

-- Influencers can read only their own profile (needed by requireInfluencerAuth)
DROP POLICY IF EXISTS "Influencers read own profile" ON influencer_profiles;
CREATE POLICY "Influencers read own profile"
  ON influencer_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admin full access (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Admin manages influencer profiles" ON influencer_profiles;
CREATE POLICY "Admin manages influencer profiles"
  ON influencer_profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
