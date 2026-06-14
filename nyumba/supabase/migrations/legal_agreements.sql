-- Legal Agreements System
-- Run in Supabase SQL Editor after crm_fix_and_missing_tables.sql
-- Date: 2026-06-14

-- ── 0. Helper function (idempotent) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 1. ALTER users — add agreement + account status columns ─────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS agreement_accepted     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_version      TEXT,
  ADD COLUMN IF NOT EXISTS account_status         TEXT        NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned', 'pending_agreement'));

-- ── 2. agreement_versions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agreement_versions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role         TEXT        NOT NULL CHECK (role IN ('client', 'dalali')),
  version      TEXT        NOT NULL,
  title_sw     TEXT        NOT NULL,
  title_en     TEXT        NOT NULL,
  content_sw   TEXT        NOT NULL,
  content_en   TEXT        NOT NULL,
  is_current   BOOLEAN     NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role, version)
);

-- ── 3. user_agreements ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_agreements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_id        UUID        NOT NULL REFERENCES agreement_versions(id),
  accepted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_name_signed  TEXT        NOT NULL,
  phone_signed      TEXT        NOT NULL,
  ip_address        TEXT,
  user_agent        TEXT,
  checkboxes_checked JSONB      NOT NULL DEFAULT '{}',
  UNIQUE(user_id, version_id)
);

CREATE INDEX IF NOT EXISTS user_agreements_user_idx    ON user_agreements (user_id);
CREATE INDEX IF NOT EXISTS user_agreements_version_idx ON user_agreements (version_id);

-- ── 4. agreement_violations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agreement_violations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  violation_type   TEXT        NOT NULL CHECK (violation_type IN (
    'fake_listing', 'fraud', 'harassment', 'spam',
    'price_manipulation', 'fake_identity', 'other'
  )),
  description      TEXT        NOT NULL,
  evidence_urls    JSONB       DEFAULT '[]',
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  action_taken     TEXT,
  admin_notes      TEXT,
  resolved_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS violations_updated_at ON agreement_violations;
CREATE TRIGGER violations_updated_at
  BEFORE UPDATE ON agreement_violations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS violations_reporter_idx  ON agreement_violations (reporter_id);
CREATE INDEX IF NOT EXISTS violations_reported_idx  ON agreement_violations (reported_user_id);
CREATE INDEX IF NOT EXISTS violations_status_idx    ON agreement_violations (status);
CREATE INDEX IF NOT EXISTS violations_created_idx   ON agreement_violations (created_at DESC);

-- ── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE agreement_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_agreements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_violations ENABLE ROW LEVEL SECURITY;

-- agreement_versions — public read (needed during signup before user exists)
DROP POLICY IF EXISTS "public_read_agreement_versions" ON agreement_versions;
CREATE POLICY "public_read_agreement_versions" ON agreement_versions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_manage_agreement_versions" ON agreement_versions;
CREATE POLICY "admin_manage_agreement_versions" ON agreement_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- user_agreements
DROP POLICY IF EXISTS "admin_all_user_agreements" ON user_agreements;
CREATE POLICY "admin_all_user_agreements" ON user_agreements
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "user_read_own_agreement" ON user_agreements;
CREATE POLICY "user_read_own_agreement" ON user_agreements
  FOR SELECT USING (user_id = auth.uid());

-- agreement_violations
DROP POLICY IF EXISTS "admin_all_violations" ON agreement_violations;
CREATE POLICY "admin_all_violations" ON agreement_violations
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "reporter_read_own_violations" ON agreement_violations;
CREATE POLICY "reporter_read_own_violations" ON agreement_violations
  FOR SELECT USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "user_insert_violation" ON agreement_violations;
CREATE POLICY "user_insert_violation" ON agreement_violations
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- ── 6. Seed initial agreement versions ──────────────────────────────────────
INSERT INTO agreement_versions (role, version, title_sw, title_en, content_sw, content_en, is_current, published_at)
VALUES
(
  'client', '1.0',
  'Masharti na Miongozo ya Matumizi — Mteja',
  'Terms and Conditions of Use — Client',
  'Masharti kamili ya matumizi ya jukwaa la NyumbaFasta kwa wateja.',
  'Complete terms of use for the NyumbaFasta platform for clients.',
  true,
  NOW()
),
(
  'dalali', '1.0',
  'Mkataba wa Dalali — NyumbaFasta',
  'Broker Agreement — NyumbaFasta',
  'Mkataba kamili kwa madalali wanaotumia jukwaa la NyumbaFasta.',
  'Complete broker agreement for agents using the NyumbaFasta platform.',
  true,
  NOW()
)
ON CONFLICT (role, version) DO NOTHING;

-- ── 7. Auto-accept for existing admin users ──────────────────────────────────
-- Admins bypass the agreement flow
UPDATE users SET
  agreement_accepted    = true,
  agreement_accepted_at = NOW(),
  agreement_version     = '1.0',
  account_status        = 'active'
WHERE role = 'admin'
  AND agreement_accepted = false;
