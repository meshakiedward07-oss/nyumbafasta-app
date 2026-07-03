-- ============================================================
-- NyumbaFasta — Comprehensive Database Audit Fixes
-- Date: 2026-06-30
-- Run in Supabase SQL Editor (safe to re-run — all idempotent)
-- ============================================================

-- ── Ensure update_updated_at() exists ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 1: FIX ENUM TYPES (PostgreSQL native enums)
-- ══════════════════════════════════════════════════════════════

-- 1a. user_role enum — add 'staff'
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';

-- 1b. listing_type enum — add 'duka'
ALTER TYPE listing_type ADD VALUE IF NOT EXISTS 'duka';

-- 1c. listing_status enum — add 'deleted' (if enum exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_status') THEN
    EXECUTE 'ALTER TYPE listing_status ADD VALUE IF NOT EXISTS ''deleted''';
  END IF;
END $$;

-- 1d. Numeric CHECK constraints (safe on any column type)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_price_positive;
ALTER TABLE listings ADD CONSTRAINT listings_price_positive
  CHECK (price_monthly > 0);

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_bedrooms_valid;
ALTER TABLE listings ADD CONSTRAINT listings_bedrooms_valid
  CHECK (bedrooms IS NULL OR (bedrooms >= 0 AND bedrooms <= 50));

ALTER TABLE boost_payments DROP CONSTRAINT IF EXISTS boost_payments_positive;
ALTER TABLE boost_payments ADD CONSTRAINT boost_payments_positive
  CHECK (amount > 0);


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- ══════════════════════════════════════════════════════════════

-- ── 2a. users ────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS region             TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_title        TEXT,
  ADD COLUMN IF NOT EXISTS staff_active       BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_leads_capacity INTEGER DEFAULT 20;

-- ── 2b. listings ─────────────────────────────────────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS street                  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ward                    TEXT,
  ADD COLUMN IF NOT EXISTS mtaa                    TEXT,
  ADD COLUMN IF NOT EXISTS location_display        TEXT,
  ADD COLUMN IF NOT EXISTS address_full            TEXT,
  ADD COLUMN IF NOT EXISTS place_id                TEXT,
  ADD COLUMN IF NOT EXISTS video_url               TEXT,
  ADD COLUMN IF NOT EXISTS deposit_months          INTEGER,
  ADD COLUMN IF NOT EXISTS shop_size_sqm           INTEGER,
  ADD COLUMN IF NOT EXISTS floor_level             INTEGER,
  ADD COLUMN IF NOT EXISTS has_parking             BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_electricity         BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_water               BOOLEAN,
  ADD COLUMN IF NOT EXISTS commercial_use          TEXT,
  ADD COLUMN IF NOT EXISTS latitude                NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude               NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS share_count             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boosted_until           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_count             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewed_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_reminded_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason        TEXT,
  ADD COLUMN IF NOT EXISTS expires_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_unit_type       TEXT DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS total_capacity          INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_occupancy       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_deactivate_on_full BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS occupancy_last_updated  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_deactivated_at     TIMESTAMPTZ;

-- ── 2c. dalali_profiles ──────────────────────────────────────
ALTER TABLE dalali_profiles
  ADD COLUMN IF NOT EXISTS operating_areas          TEXT[],
  ADD COLUMN IF NOT EXISTS total_leads              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS dalali_profiles_updated_at ON dalali_profiles;
CREATE TRIGGER dalali_profiles_updated_at
  BEFORE UPDATE ON dalali_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 2d. reviews ──────────────────────────────────────────────
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS listing_id    UUID REFERENCES listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS found_house   BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_verified   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response      TEXT,
  ADD COLUMN IF NOT EXISTS response_at   TIMESTAMPTZ;

-- ── 2e. subscriptions ────────────────────────────────────────
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_reminded_at TIMESTAMPTZ;

-- ── 2f. contact_unlocks ──────────────────────────────────────
ALTER TABLE contact_unlocks
  ADD COLUMN IF NOT EXISTS expires_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at   TIMESTAMPTZ;

-- ── 2g. saved_listings — rename user_id → client_id if needed ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'saved_listings'
      AND column_name  = 'user_id'
  ) THEN
    ALTER TABLE saved_listings RENAME COLUMN user_id TO client_id;
  END IF;
END $$;

-- ── 2h. agent_leads ──────────────────────────────────────────
ALTER TABLE agent_leads
  ADD COLUMN IF NOT EXISTS assigned_to              UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pipeline_stage           TEXT NOT NULL DEFAULT 'mpya',
  ADD COLUMN IF NOT EXISTS last_contacted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_attempts         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_followup_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_to_profile_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_to_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_listing_id         UUID REFERENCES listings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_listing_at         TIMESTAMPTZ;


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: CREATE MISSING TABLES + ENSURE ALL COLUMNS EXIST
-- (CREATE TABLE IF NOT EXISTS skips if table exists, so we
--  follow each with ALTER TABLE ADD COLUMN IF NOT EXISTS for
--  every non-PK column to handle pre-existing partial schemas)
-- ══════════════════════════════════════════════════════════════

-- ── 3a. lead_communications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_communications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID        NOT NULL REFERENCES agent_leads(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'note',
  direction  TEXT        NOT NULL DEFAULT 'outbound',
  content    TEXT        NOT NULL DEFAULT '',
  created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lead_communications
  ADD COLUMN IF NOT EXISTS type       TEXT        NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS direction  TEXT        NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS content    TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE lead_communications DROP CONSTRAINT IF EXISTS lead_comms_type_check;
ALTER TABLE lead_communications ADD CONSTRAINT lead_comms_type_check
  CHECK (type IN ('call', 'whatsapp', 'sms', 'email', 'note', 'viewing'));

ALTER TABLE lead_communications DROP CONSTRAINT IF EXISTS lead_comms_direction_check;
ALTER TABLE lead_communications ADD CONSTRAINT lead_comms_direction_check
  CHECK (direction IN ('inbound', 'outbound', 'internal'));

ALTER TABLE lead_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_lead_comms" ON lead_communications;
CREATE POLICY "admin_all_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_own_lead_comms" ON lead_communications;
CREATE POLICY "staff_own_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_communications.lead_id AND assigned_to = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_lead_comms_lead_id ON lead_communications (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_comms_type    ON lead_communications (type);
CREATE INDEX IF NOT EXISTS idx_lead_comms_created ON lead_communications (created_at DESC);

-- ── 3b. lead_tasks ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID        NOT NULL REFERENCES agent_leads(id) ON DELETE CASCADE,
  assigned_to  UUID        REFERENCES users(id) ON DELETE SET NULL,
  description  TEXT        NOT NULL DEFAULT '',
  due_at       TIMESTAMPTZ,
  status       TEXT        NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lead_tasks
  ADD COLUMN IF NOT EXISTS assigned_to  UUID        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description  TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS due_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status       TEXT        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE lead_tasks DROP CONSTRAINT IF EXISTS lead_tasks_status_check;
ALTER TABLE lead_tasks ADD CONSTRAINT lead_tasks_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled'));

DROP TRIGGER IF EXISTS lead_tasks_updated_at ON lead_tasks;
CREATE TRIGGER lead_tasks_updated_at
  BEFORE UPDATE ON lead_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_lead_tasks" ON lead_tasks;
CREATE POLICY "admin_all_lead_tasks" ON lead_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_own_lead_tasks" ON lead_tasks;
CREATE POLICY "staff_own_lead_tasks" ON lead_tasks
  FOR ALL USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_tasks.lead_id AND assigned_to = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id     ON lead_tasks (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_to ON lead_tasks (assigned_to);
-- Note: partial index on text column, no WHERE clause to avoid column-not-found on old schemas
CREATE INDEX IF NOT EXISTS idx_lead_tasks_status      ON lead_tasks (status);

-- ── 3c. call_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID        NOT NULL REFERENCES agent_leads(id) ON DELETE CASCADE,
  dalali_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  outcome          TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS dalali_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS outcome          TEXT,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS call_logs_outcome_check;
ALTER TABLE call_logs ADD CONSTRAINT call_logs_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('answered', 'no_answer', 'busy', 'unreachable', 'voicemail'));

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_call_logs" ON call_logs;
CREATE POLICY "admin_all_call_logs" ON call_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_own_call_logs" ON call_logs;
CREATE POLICY "staff_own_call_logs" ON call_logs
  FOR ALL USING (
    dalali_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = call_logs.lead_id AND assigned_to = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id   ON call_logs (lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_dalali_id ON call_logs (dalali_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_created   ON call_logs (created_at DESC);


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: MISSING INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_listings_dalali_id      ON listings (dalali_id);
CREATE INDEX IF NOT EXISTS idx_listings_status         ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_amenities_gin  ON listings USING gin (amenities);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id     ON reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id      ON reviews (listing_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status    ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active    ON subscriptions (expires_at)
  WHERE status IN ('active', 'grace_period');
CREATE INDEX IF NOT EXISTS agent_leads_assigned_to_idx ON agent_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_agent_leads_active      ON agent_leads (created_at DESC)
  WHERE status NOT IN ('converted', 'rejected', 'duplicate');
CREATE INDEX IF NOT EXISTS idx_agent_leads_pipeline    ON agent_leads (pipeline_stage, assigned_to);
CREATE INDEX IF NOT EXISTS idx_notifications_data_gin  ON notifications USING gin (data);
CREATE INDEX IF NOT EXISTS idx_unlocks_reminder_sent   ON contact_unlocks (reminder_sent_at)
  WHERE reminder_sent_at IS NULL AND status = 'completed';
CREATE INDEX IF NOT EXISTS idx_saved_listings_client_id ON saved_listings (client_id);


-- ══════════════════════════════════════════════════════════════
-- SECTION 5: MISSING updated_at TRIGGERS
-- ══════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS dalali_profiles_updated_at ON dalali_profiles;
CREATE TRIGGER dalali_profiles_updated_at
  BEFORE UPDATE ON dalali_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS whatsapp_templates_updated_at ON whatsapp_templates;
CREATE TRIGGER whatsapp_templates_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tiktok_posts_updated_at ON tiktok_posts;
CREATE TRIGGER tiktok_posts_updated_at
  BEFORE UPDATE ON tiktok_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tiktok_connections_updated_at ON tiktok_connections;
CREATE TRIGGER tiktok_connections_updated_at
  BEFORE UPDATE ON tiktok_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS commissions_updated_at ON commissions;
CREATE TRIGGER commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ══════════════════════════════════════════════════════════════
-- SECTION 6: FIX RLS POLICIES FOR saved_listings
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "saved_listings_select" ON saved_listings;
DROP POLICY IF EXISTS "saved_listings_insert" ON saved_listings;
DROP POLICY IF EXISTS "saved_listings_delete" ON saved_listings;
DROP POLICY IF EXISTS "saved_listings_policy" ON saved_listings;
DROP POLICY IF EXISTS "users_own_saved"        ON saved_listings;

ALTER TABLE saved_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_listings_select" ON saved_listings
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "saved_listings_insert" ON saved_listings
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "saved_listings_delete" ON saved_listings
  FOR DELETE USING (client_id = auth.uid());
