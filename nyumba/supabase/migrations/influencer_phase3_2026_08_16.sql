-- influencer_phase3_2026_08_16.sql
-- Phase 3: Referral link and attribution
--
-- Records which influencer referred which dalali, using the referral_code
-- at the time of signup. This is the single source of truth for attribution.
-- Payout stage tracking is added in Phase 4.
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS throughout

-- ── Referral attributions table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_attributions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id        UUID        NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  referred_user_id     UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referral_code        TEXT        NOT NULL,
  signed_up_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_attr_influencer ON referral_attributions(influencer_id);
CREATE INDEX IF NOT EXISTS idx_referral_attr_referred   ON referral_attributions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_attr_code       ON referral_attributions(referral_code);

ALTER TABLE referral_attributions ENABLE ROW LEVEL SECURITY;

-- Influencers can read their own referrals
DROP POLICY IF EXISTS "Influencers read own referrals" ON referral_attributions;
CREATE POLICY "Influencers read own referrals"
  ON referral_attributions FOR SELECT
  USING (
    influencer_id IN (
      SELECT id FROM influencer_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin manages referral attributions" ON referral_attributions;
CREATE POLICY "Admin manages referral attributions"
  ON referral_attributions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
