-- influencer_phase4_2026_08_16.sql
-- Phase 4: Payout ledger and stage tracking
--
-- Three independent earning stages per referred dalali (all within 100 days of signup):
--   Stage 1: TSh 300  — 3 verified listings approved (7-day fraud hold)
--   Stage 2: TSh 700  — first real paid subscription payment
--   Stage 3: TSh 1,000 — second real paid subscription payment
--
-- Trial subscriptions do NOT count. Stages are independent — no clawback.
-- status flow: hold → earned → paid  (stage 1 starts as hold; stages 2/3 start as earned)
--
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS throughout

CREATE TABLE IF NOT EXISTS influencer_payout_stages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id     UUID        NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  referred_user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage             SMALLINT    NOT NULL CHECK (stage IN (1, 2, 3)),
  amount_tzs        INTEGER     NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'hold'
                                CHECK (status IN ('hold', 'earned', 'paid')),
  hold_until        TIMESTAMPTZ,  -- set for stage 1 (fraud hold); null for stages 2+3
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  admin_note        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (influencer_id, referred_user_id, stage)   -- each stage earned at most once per referral
);

CREATE INDEX IF NOT EXISTS idx_payout_stages_influencer ON influencer_payout_stages(influencer_id);
CREATE INDEX IF NOT EXISTS idx_payout_stages_referred   ON influencer_payout_stages(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_stages_status     ON influencer_payout_stages(status);

ALTER TABLE influencer_payout_stages ENABLE ROW LEVEL SECURITY;

-- Influencers read their own payout stages
DROP POLICY IF EXISTS "Influencers read own payout stages" ON influencer_payout_stages;
CREATE POLICY "Influencers read own payout stages"
  ON influencer_payout_stages FOR SELECT
  USING (
    influencer_id IN (
      SELECT id FROM influencer_profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admin manages payout stages" ON influencer_payout_stages;
CREATE POLICY "Admin manages payout stages"
  ON influencer_payout_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
