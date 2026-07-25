-- ══════════════════════════════════════════════════════════════════════════════
-- master_fix_all_features_2026_07_25.sql
-- Run in Supabase → SQL Editor
-- Safe to run multiple times (idempotent — CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
--
-- Fixes ALL broken features in one shot:
--   1.  Missing columns on users  →  staff dashboard loads, requireStaffAuth works
--   2.  staff_permissions / staff_activity_log  →  permissions work
--   3.  staff_assignments (correct column names)  →  assignments tab works
--   4.  staff_legal_info / staff_documents / staff_payroll  →  profile tab works
--   5.  agent_leads (+ assigned_to / pipeline_stage columns)  →  dashboard counts
--   6.  leads + lead_import_batches  →  /admin/staff-leads works
--   7.  WhatsApp tables  →  WhatsApp panel shows chats
--   8.  Social media tables  →  social dashboard works
--   9.  income_records / expense_records / recurring_expenses  →  analytics works
--  10.  share_count / view_count / lead_count on listings  →  listing analytics works
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Critical — add missing columns on public.users
--         staff_active being absent makes requireStaffAuth() return 403 for
--         EVERY request, breaking the entire staff dashboard and actions.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure 'staff' is a valid user_role value (safe no-op if already present)
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS staff_title        TEXT,
  ADD COLUMN IF NOT EXISTS staff_active       BOOLEAN      DEFAULT true,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_leads_capacity INTEGER      DEFAULT 20,
  ADD COLUMN IF NOT EXISTS role_template      TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: staff_permissions — controls what each staff member can do
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_permissions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key TEXT         NOT NULL,
  granted_by     UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  granted_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_sp2_staff    ON staff_permissions (staff_id);
CREATE INDEX IF NOT EXISTS idx_sp2_perm_key ON staff_permissions (permission_key);

ALTER TABLE staff_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_staff_permissions" ON staff_permissions;
CREATE POLICY "admin_manage_staff_permissions" ON staff_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: staff_activity_log — tracks every staff action
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_activity_log (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type   TEXT         NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  description   TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sal2_staff   ON staff_activity_log (staff_id);
CREATE INDEX IF NOT EXISTS idx_sal2_created ON staff_activity_log (created_at DESC);

ALTER TABLE staff_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_all_activity" ON staff_activity_log;
CREATE POLICY "admin_read_all_activity" ON staff_activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_read_own_activity" ON staff_activity_log;
CREATE POLICY "staff_read_own_activity" ON staff_activity_log
  FOR SELECT USING (staff_id = auth.uid());

DROP POLICY IF EXISTS "staff_insert_own_activity" ON staff_activity_log;
CREATE POLICY "staff_insert_own_activity" ON staff_activity_log
  FOR INSERT WITH CHECK (
    staff_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: staff_assignments
--         IMPORTANT: code queries 'category', 'ref_type', 'due_date' but the
--         old staff_system_tables_2026_07_25.sql created 'type', (no ref_type),
--         'due_at'. We create with correct names and add missing columns in case
--         the old migration was already run.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_assignments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by  UUID         NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  title        TEXT         NOT NULL,
  description  TEXT,
  category     TEXT         NOT NULL DEFAULT 'other',
  ref_type     TEXT,
  ref_id       UUID,
  priority     TEXT         NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status       TEXT         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date     TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add columns if old migration ran first with wrong names
ALTER TABLE staff_assignments ADD COLUMN IF NOT EXISTS category     TEXT DEFAULT 'other';
ALTER TABLE staff_assignments ADD COLUMN IF NOT EXISTS ref_type     TEXT;
ALTER TABLE staff_assignments ADD COLUMN IF NOT EXISTS due_date     TIMESTAMPTZ;
ALTER TABLE staff_assignments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sas_staff    ON staff_assignments (staff_id);
CREATE INDEX IF NOT EXISTS idx_sas_status   ON staff_assignments (status);
CREATE INDEX IF NOT EXISTS idx_sas_by       ON staff_assignments (assigned_by);
CREATE INDEX IF NOT EXISTS idx_sas_created  ON staff_assignments (created_at DESC);

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_assignments_select" ON staff_assignments;
CREATE POLICY "staff_assignments_select" ON staff_assignments
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_assignments_admin_write" ON staff_assignments;
CREATE POLICY "staff_assignments_admin_write" ON staff_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: staff_legal_info — NIDA, TIN, bank, emergency contacts, etc.
--         The old migration had wrong/missing columns. This creates the correct
--         schema matching ALLOWED_FIELDS in /api/v1/staff/legal/route.ts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_legal_info (
  id                         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id                   UUID         NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  nida_number                TEXT,
  date_of_birth              DATE,
  nationality                TEXT         DEFAULT 'Tanzanian',
  marital_status             TEXT,
  tin_number                 TEXT,
  nssf_number                TEXT,
  nhif_number                TEXT,
  bank_name                  TEXT,
  bank_account_number        TEXT,
  bank_branch                TEXT,
  mobile_money_network       TEXT,
  mobile_money_number        TEXT,
  emergency_contact_name     TEXT,
  emergency_contact_phone    TEXT,
  emergency_contact_relation TEXT,
  verification_status        TEXT         NOT NULL DEFAULT 'unsubmitted'
                                          CHECK (verification_status IN ('unsubmitted','pending','verified','rejected')),
  verified_at                TIMESTAMPTZ,
  rejection_reason           TEXT,
  admin_notes                TEXT,
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add any columns the old migration may have skipped
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS date_of_birth              DATE;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS nationality                TEXT DEFAULT 'Tanzanian';
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS marital_status             TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS tin_number                 TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS nssf_number                TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS nhif_number                TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS bank_name                  TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS bank_account_number        TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS bank_branch                TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS mobile_money_network       TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS mobile_money_number        TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS emergency_contact_name     TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS emergency_contact_phone    TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS verification_status        TEXT DEFAULT 'unsubmitted';
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS verified_at                TIMESTAMPTZ;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS rejection_reason           TEXT;
ALTER TABLE staff_legal_info ADD COLUMN IF NOT EXISTS admin_notes                TEXT;

CREATE INDEX IF NOT EXISTS idx_sli2_staff ON staff_legal_info (staff_id);

ALTER TABLE staff_legal_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_legal_select" ON staff_legal_info;
CREATE POLICY "staff_legal_select" ON staff_legal_info
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_legal_write" ON staff_legal_info;
CREATE POLICY "staff_legal_write" ON staff_legal_info
  FOR ALL USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: staff_documents — uploaded files (contracts, NIDA, certificates)
--         Route orders by uploaded_at; needs document_type, document_name, etc.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_documents (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  uploaded_by   UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  document_type TEXT         NOT NULL DEFAULT 'other',
  document_name TEXT         NOT NULL,
  document_url  TEXT         NOT NULL,
  file_type     TEXT,
  file_size_kb  INTEGER,
  is_verified   BOOLEAN      NOT NULL DEFAULT false,
  is_private    BOOLEAN      NOT NULL DEFAULT true,
  notes         TEXT,
  uploaded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Compat aliases in case old migration ran with different column names
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'other';
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS document_name TEXT;
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS document_url  TEXT;
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS file_type     TEXT;
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS file_size_kb  INTEGER;
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS is_verified   BOOLEAN DEFAULT false;
ALTER TABLE staff_documents ADD COLUMN IF NOT EXISTS uploaded_at   TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sd2_staff   ON staff_documents (staff_id);
CREATE INDEX IF NOT EXISTS idx_sd2_type    ON staff_documents (document_type);
CREATE INDEX IF NOT EXISTS idx_sd2_upload  ON staff_documents (uploaded_at DESC);

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_docs_select" ON staff_documents;
CREATE POLICY "staff_docs_select" ON staff_documents
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_docs_admin_write" ON staff_documents;
CREATE POLICY "staff_docs_admin_write" ON staff_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: staff_payroll — monthly payroll records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_payroll (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  processed_by    UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  period_month    INTEGER       NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INTEGER       NOT NULL,
  basic_salary    NUMERIC(12,2) NOT NULL DEFAULT 0,
  house_allowance NUMERIC(12,2) DEFAULT 0,
  transport_allowance NUMERIC(12,2) DEFAULT 0,
  other_allowances NUMERIC(12,2) DEFAULT 0,
  nssf_deduction  NUMERIC(12,2) DEFAULT 0,
  nhif_deduction  NUMERIC(12,2) DEFAULT 0,
  paye_tax        NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay         NUMERIC(12,2),
  currency        TEXT          NOT NULL DEFAULT 'TZS',
  payment_method  TEXT,
  payment_ref     TEXT,
  status          TEXT          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_spay_staff  ON staff_payroll (staff_id);
CREATE INDEX IF NOT EXISTS idx_spay_period ON staff_payroll (period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_spay_status ON staff_payroll (status);

ALTER TABLE staff_payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_payroll_select" ON staff_payroll;
CREATE POLICY "staff_payroll_select" ON staff_payroll
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_payroll_admin_write" ON staff_payroll;
CREATE POLICY "staff_payroll_admin_write" ON staff_payroll
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: agent_leads — prospective dalali (CRM for staff onboarding)
--         Base table + add missing columns for dashboard queries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_leads (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT,
  phone               TEXT,
  whatsapp            TEXT,
  email               TEXT,
  business_name       TEXT,
  region              TEXT,
  district            TEXT,
  address             TEXT,
  facebook_url        TEXT,
  instagram_url       TEXT,
  tiktok_url          TEXT,
  website_url         TEXT,
  source              TEXT         NOT NULL DEFAULT 'manual',
  source_url          TEXT,
  source_id           TEXT,
  ai_score            INTEGER      CHECK (ai_score BETWEEN 0 AND 100),
  ai_notes            TEXT,
  ai_analyzed_at      TIMESTAMPTZ,
  pipeline_stage      TEXT         NOT NULL DEFAULT 'jiandikisho'
                                   CHECK (pipeline_stage IN (
                                     'jiandikisho','mawasiliano','mkutano',
                                     'amefunguliwa','amefanikiwa','amepotea'
                                   )),
  status              TEXT         NOT NULL DEFAULT 'new'
                                   CHECK (status IN (
                                     'new','contacted','interested','converted','rejected','duplicate'
                                   )),
  assigned_to         UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  contacted_at        TIMESTAMPTZ,
  converted_at        TIMESTAMPTZ,
  converted_to_user_id UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  notes               TEXT,
  raw_data            JSONB,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ensure required columns exist if table already existed with old schema
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS pipeline_stage      TEXT DEFAULT 'jiandikisho';
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS assigned_to         UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS converted_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS whatsapp            TEXT;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS district            TEXT;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS facebook_url        TEXT;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS instagram_url       TEXT;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS tiktok_url          TEXT;
ALTER TABLE agent_leads ADD COLUMN IF NOT EXISTS website_url         TEXT;

CREATE INDEX IF NOT EXISTS idx_al2_status      ON agent_leads (status);
CREATE INDEX IF NOT EXISTS idx_al2_region      ON agent_leads (region);
CREATE INDEX IF NOT EXISTS idx_al2_source      ON agent_leads (source);
CREATE INDEX IF NOT EXISTS idx_al2_assigned    ON agent_leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_al2_pipeline    ON agent_leads (pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_al2_score       ON agent_leads (ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_al2_converted   ON agent_leads (converted_to_user_id);

ALTER TABLE agent_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_own_leads" ON agent_leads;
CREATE POLICY "staff_read_own_leads" ON agent_leads
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_update_own_leads" ON agent_leads;
CREATE POLICY "staff_update_own_leads" ON agent_leads
  FOR UPDATE USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

DROP POLICY IF EXISTS "admin_manage_leads" ON agent_leads;
CREATE POLICY "admin_manage_leads" ON agent_leads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 9: leads + lead_import_batches — /admin/staff-leads route
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lead_import_batches (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  filename         TEXT         NOT NULL,
  total_rows       INTEGER      DEFAULT 0,
  imported         INTEGER      DEFAULT 0,
  duplicates_found INTEGER      DEFAULT 0,
  dead_leads_found INTEGER      DEFAULT 0,
  active_leads     INTEGER      DEFAULT 0,
  status           TEXT         DEFAULT 'processing',
  error_message    TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS leads (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             TEXT         NOT NULL,
  phone                 TEXT,
  phone_2               TEXT,
  email                 TEXT,
  ward                  TEXT,
  district              TEXT,
  region                TEXT         DEFAULT 'Dar es Salaam',
  address               TEXT,
  lead_type             TEXT         DEFAULT 'dalali',
  source                TEXT         DEFAULT 'manual',
  notes                 TEXT,
  facebook_url          TEXT,
  instagram_url         TEXT,
  tiktok_url            TEXT,
  whatsapp_number       TEXT,
  linkedin_url          TEXT,
  twitter_url           TEXT,
  facebook_status       TEXT         DEFAULT 'unchecked',
  instagram_status      TEXT         DEFAULT 'unchecked',
  tiktok_status         TEXT         DEFAULT 'unchecked',
  whatsapp_status       TEXT         DEFAULT 'unchecked',
  facebook_verified_at  TIMESTAMPTZ,
  instagram_verified_at TIMESTAMPTZ,
  tiktok_verified_at    TIMESTAMPTZ,
  whatsapp_verified_at  TIMESTAMPTZ,
  social_score          INTEGER      DEFAULT 0,
  contact_quality       TEXT         DEFAULT 'unknown',
  has_valid_phone       BOOLEAN      DEFAULT false,
  has_valid_email       BOOLEAN      DEFAULT false,
  has_any_social        BOOLEAN      DEFAULT false,
  is_dead_lead          BOOLEAN      DEFAULT false,
  is_duplicate          BOOLEAN      DEFAULT false,
  duplicate_of          UUID         REFERENCES leads(id) ON DELETE SET NULL,
  duplicate_reason      TEXT,
  name_similarity_score NUMERIC,
  status                TEXT         DEFAULT 'new',
  contacted_at          TIMESTAMPTZ,
  registered_at         TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ,
  assigned_to           UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  import_batch_id       UUID         REFERENCES lead_import_batches(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads2_status     ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads2_assigned   ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads2_region     ON leads (region);
CREATE INDEX IF NOT EXISTS idx_leads2_source     ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads2_score      ON leads (social_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads2_dead       ON leads (is_dead_lead);
CREATE INDEX IF NOT EXISTS idx_leads2_dup        ON leads (is_duplicate);
CREATE INDEX IF NOT EXISTS idx_leads2_created    ON leads (created_at DESC);

ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_import_batches DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 10: WhatsApp tables — WhatsApp panel shows chats
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number      TEXT         NOT NULL UNIQUE,
  status            TEXT         NOT NULL DEFAULT 'amina'
                                 CHECK (status IN ('amina', 'pending', 'admin', 'resolved')),
  assigned_admin_id UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  escalation_reason TEXT,
  escalated_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  last_message_at   TIMESTAMPTZ  DEFAULT NOW(),
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT         NOT NULL,
  direction    TEXT         NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender       TEXT         NOT NULL CHECK (sender IN ('user', 'amina', 'admin', 'system')),
  content      TEXT         NOT NULL,
  message_id   TEXT         UNIQUE,
  status       TEXT         NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  target           TEXT         NOT NULL,
  message          TEXT         NOT NULL,
  tone             TEXT         NOT NULL DEFAULT 'personal'
                                CHECK (tone IN ('personal', 'formal', 'urgent')),
  recipients_count INTEGER      DEFAULT 0,
  sent_count       INTEGER      DEFAULT 0,
  failed_count     INTEGER      DEFAULT 0,
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS amina_instructions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  instruction  TEXT         NOT NULL,
  scope        TEXT         NOT NULL DEFAULT 'global'
                            CHECK (scope IN ('global', 'phone_specific')),
  phone_number TEXT,
  active       BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws2_phone    ON whatsapp_sessions (phone_number);
CREATE INDEX IF NOT EXISTS idx_ws2_status   ON whatsapp_sessions (status);
CREATE INDEX IF NOT EXISTS idx_ws2_updated  ON whatsapp_sessions (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm2_phone    ON whatsapp_messages (phone_number);
CREATE INDEX IF NOT EXISTS idx_wm2_created  ON whatsapp_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm2_pc       ON whatsapp_messages (phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wb2_status   ON whatsapp_broadcasts (status);
CREATE INDEX IF NOT EXISTS idx_ai2_scope    ON amina_instructions (scope, active);

ALTER TABLE whatsapp_sessions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages    DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcasts  DISABLE ROW LEVEL SECURITY;
ALTER TABLE amina_instructions   DISABLE ROW LEVEL SECURITY;

-- Enable realtime for WhatsApp panel
DO $$ BEGIN
  PERFORM pg_catalog.set_config('search_path', 'extensions', false);
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 11: Social media tables — social dashboard works
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS social_posts (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id           UUID         REFERENCES public.listings(id) ON DELETE SET NULL,
  platform             TEXT         NOT NULL CHECK (platform IN ('instagram', 'facebook', 'both')),
  media_type           TEXT         NOT NULL DEFAULT 'image'
                                    CHECK (media_type IN ('image', 'video', 'carousel', 'reel')),
  caption              TEXT         NOT NULL,
  hashtags             TEXT,
  instagram_post_id    TEXT,
  instagram_container_id TEXT,
  facebook_post_id     TEXT,
  status               TEXT         NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  error_message        TEXT,
  scheduled_at         TIMESTAMPTZ,
  published_at         TIMESTAMPTZ,
  metrics              JSONB,
  metrics_updated_at   TIMESTAMPTZ,
  created_by           UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_comments (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        UUID         REFERENCES social_posts(id) ON DELETE SET NULL,
  platform       TEXT         NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  comment_id     TEXT         NOT NULL UNIQUE,
  commenter_id   TEXT         NOT NULL,
  commenter_name TEXT,
  comment_text   TEXT         NOT NULL,
  comment_type   TEXT         NOT NULL DEFAULT 'unknown'
                              CHECK (comment_type IN ('inquiry', 'interest', 'negative', 'spam', 'question', 'praise', 'unknown')),
  reply_sent     BOOLEAN      NOT NULL DEFAULT false,
  reply_text     TEXT,
  replied_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_dms (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  platform     TEXT         NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  sender_id    TEXT         NOT NULL,
  sender_name  TEXT,
  message_id   TEXT         UNIQUE,
  message_text TEXT         NOT NULL,
  reply_sent   BOOLEAN      NOT NULL DEFAULT false,
  reply_text   TEXT,
  replied_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_schedule (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID         REFERENCES public.listings(id) ON DELETE CASCADE,
  platform     TEXT         NOT NULL CHECK (platform IN ('instagram', 'facebook', 'both')),
  scheduled_at TIMESTAMPTZ  NOT NULL,
  status       TEXT         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
  post_id      UUID         REFERENCES social_posts(id) ON DELETE SET NULL,
  created_by   UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spost_listing    ON social_posts (listing_id);
CREATE INDEX IF NOT EXISTS idx_spost_status     ON social_posts (status);
CREATE INDEX IF NOT EXISTS idx_spost_platform   ON social_posts (platform);
CREATE INDEX IF NOT EXISTS idx_spost_published  ON social_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_scomm_post       ON social_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_scomm_platform   ON social_comments (platform);
CREATE INDEX IF NOT EXISTS idx_sdm_sender       ON social_dms (sender_id);
CREATE INDEX IF NOT EXISTS idx_sdm_platform     ON social_dms (platform);
CREATE INDEX IF NOT EXISTS idx_sched_at         ON post_schedule (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sched_status     ON post_schedule (status);

ALTER TABLE social_posts     DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_dms       DISABLE ROW LEVEL SECURITY;
ALTER TABLE post_schedule    DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 12: income_records / expense_records / recurring_expenses
--          Required by /api/v1/admin/analytics/route.ts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS income_records (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  source           TEXT          NOT NULL
                     CHECK (source IN ('subscription','contact_unlock','boost_listing','extra_listing','other')),
  source_ref_id    UUID,
  dalali_id        UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  listing_id       UUID          REFERENCES public.listings(id) ON DELETE SET NULL,
  amount_tzs       DECIMAL(12,2) NOT NULL,
  platform_fee_tzs DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount_tzs   DECIMAL(12,2),
  description      TEXT,
  reference_number TEXT,
  payment_method   TEXT,
  transaction_date DATE          NOT NULL,
  month            INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INTEGER       NOT NULL,
  week             INTEGER,
  status           TEXT          NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('confirmed','pending','refunded')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE income_records ADD COLUMN IF NOT EXISTS source_ref_id    UUID;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS dalali_id        UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS listing_id       UUID REFERENCES public.listings(id) ON DELETE SET NULL;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS platform_fee_tzs DECIMAL(12,2) DEFAULT 0;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS net_amount_tzs   DECIMAL(12,2);
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS description      TEXT;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS payment_method   TEXT;
ALTER TABLE income_records ADD COLUMN IF NOT EXISTS week             INTEGER;

CREATE INDEX IF NOT EXISTS idx_inc_date  ON income_records (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_inc_month ON income_records (year, month);
CREATE INDEX IF NOT EXISTS idx_inc_src   ON income_records (source);
CREATE INDEX IF NOT EXISTS idx_inc_status ON income_records (status);

ALTER TABLE income_records DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS expense_records (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT          NOT NULL,
  subcategory      TEXT,
  vendor           TEXT,
  description      TEXT,
  amount_tzs       DECIMAL(12,2) NOT NULL,
  payment_method   TEXT,
  reference_number TEXT,
  receipt_url      TEXT,
  transaction_date DATE          NOT NULL,
  month            INTEGER       NOT NULL CHECK (month BETWEEN 1 AND 12),
  year             INTEGER       NOT NULL,
  week             INTEGER,
  is_recurring     BOOLEAN       NOT NULL DEFAULT false,
  created_by       UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exp_date  ON expense_records (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_exp_month ON expense_records (year, month);
CREATE INDEX IF NOT EXISTS idx_exp_cat   ON expense_records (category);

ALTER TABLE expense_records DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT          NOT NULL,
  category         TEXT          NOT NULL,
  amount_tzs       DECIMAL(12,2) NOT NULL,
  frequency        TEXT          NOT NULL DEFAULT 'monthly'
                                 CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly')),
  next_due_date    DATE,
  last_recorded_at TIMESTAMPTZ,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_by       UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_active ON recurring_expenses (is_active);
CREATE INDEX IF NOT EXISTS idx_rec_due    ON recurring_expenses (next_due_date);

ALTER TABLE recurring_expenses DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 13: Listing analytics columns + tables
--          view_count / lead_count / share_count on listings
--          listing_views table for detailed analytics
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS view_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS lead_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_listings_share_count ON public.listings (share_count DESC);
CREATE INDEX IF NOT EXISTS idx_listings_view_count  ON public.listings (view_count DESC);

CREATE TABLE IF NOT EXISTS listing_views (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID         NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_id    UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  viewer_ip    TEXT,
  user_agent   TEXT,
  referrer     TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_contact_clicks (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID         NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  clicker_id   UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lv_listing ON listing_views (listing_id);
CREATE INDEX IF NOT EXISTS idx_lv_created ON listing_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lcc_listing ON listing_contact_clicks (listing_id);

ALTER TABLE listing_views           DISABLE ROW LEVEL SECURITY;
ALTER TABLE listing_contact_clicks  DISABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 14: Convenience function for incrementing share_count
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_share_count(listing_id UUID)
RETURNS void AS $$
  UPDATE public.listings SET share_count = share_count + 1 WHERE id = listing_id;
$$ LANGUAGE sql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 15: Guarantee admin account (meshakiedward07@gmail.com) is role=admin
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.users pu
SET
  role           = 'admin'::user_role,
  is_active      = TRUE,
  account_status = 'active',
  staff_active   = TRUE
FROM auth.users au
WHERE pu.id = au.id
  AND au.email = 'meshakiedward07@gmail.com';


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — show a summary of what was created
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'staff_active column on users'     AS check_item,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'users' AND column_name = 'staff_active'
       ) THEN 'OK ✓' ELSE 'MISSING ✗' END AS result
UNION ALL
SELECT 'staff_permissions table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_permissions')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'staff_activity_log table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_activity_log')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'staff_assignments.category column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'staff_assignments' AND column_name = 'category'
       ) THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'staff_assignments.due_date column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'staff_assignments' AND column_name = 'due_date'
       ) THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'staff_legal_info table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_legal_info')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'whatsapp_sessions table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_sessions')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'whatsapp_messages table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_messages')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'social_posts table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_posts')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'social_comments table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_comments')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'social_dms table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_dms')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'income_records table',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'income_records')
            THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'agent_leads.pipeline_stage column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'agent_leads' AND column_name = 'pipeline_stage'
       ) THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'listings.share_count column',
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'listings' AND column_name = 'share_count'
       ) THEN 'OK ✓' ELSE 'MISSING ✗' END
UNION ALL
SELECT 'admin account role',
       COALESCE((SELECT 'role=' || role::text || ' active=' || is_active::text FROM public.users WHERE email = 'meshakiedward07@gmail.com'), 'NOT FOUND');
