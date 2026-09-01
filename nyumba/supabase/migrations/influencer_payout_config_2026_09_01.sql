-- influencer_payout_config_2026_09_01.sql
-- Lets admin set the reward amount for each of the 3 influencer payout
-- stages from the admin UI, instead of the amounts being hardcoded in
-- lib/influencer/payoutTriggers.ts. Run manually in Supabase SQL Editor.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS influencer_payout_config (
  stage       SMALLINT     PRIMARY KEY CHECK (stage IN (1, 2, 3)),
  amount_tzs  INTEGER      NOT NULL CHECK (amount_tzs >= 0),
  label       TEXT         NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  UUID         REFERENCES users(id) ON DELETE SET NULL
);

-- Seed with the amounts that were previously hardcoded (300 / 700 / 1000),
-- so behavior is unchanged until an admin actually edits them.
INSERT INTO influencer_payout_config (stage, amount_tzs, label) VALUES
  (1, 300,  'Kata ya kwanza — vitengo 3 vya listing vimeidhinishwa (7-day fraud hold)'),
  (2, 700,  'Kata ya pili — malipo ya kwanza ya subscription halisi'),
  (3, 1000, 'Kata ya tatu — malipo ya pili ya subscription halisi')
ON CONFLICT (stage) DO NOTHING;

ALTER TABLE influencer_payout_config ENABLE ROW LEVEL SECURITY;

-- Admin can read + write; service_role (payoutTriggers.ts uses the admin
-- client, which bypasses RLS anyway, but this keeps the table's policy
-- shape consistent with every other influencer_* table).
DROP POLICY IF EXISTS "Admin manages payout config" ON influencer_payout_config;
CREATE POLICY "Admin manages payout config"
  ON influencer_payout_config FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
