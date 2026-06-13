-- ── WhatsApp Human Handoff System ────────────────────────────────────────────
-- Run this in the Supabase SQL editor

-- 1. Conversation sessions (tracks who is handling each WhatsApp conversation)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number     TEXT        NOT NULL UNIQUE,
  status           TEXT        NOT NULL DEFAULT 'amina'
                               CHECK (status IN ('amina', 'pending', 'admin', 'resolved')),
  assigned_admin_id UUID       REFERENCES users(id) ON DELETE SET NULL,
  escalation_reason TEXT,
  escalated_at     TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  last_message_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Full WhatsApp message history for admin panel
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT    NOT NULL,
  direction    TEXT    NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender       TEXT    NOT NULL CHECK (sender IN ('user', 'amina', 'admin', 'system')),
  content      TEXT    NOT NULL,
  message_id   TEXT    UNIQUE,                              -- Meta message ID (for dedup)
  status       TEXT    NOT NULL DEFAULT 'sent'
                       CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Broadcast messages log
CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
  id               UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id         UUID    REFERENCES users(id) ON DELETE SET NULL,
  target           TEXT    NOT NULL,                        -- 'all_dalali' | 'active_dalali' | 'specific'
  message          TEXT    NOT NULL,
  tone             TEXT    NOT NULL DEFAULT 'personal'
                           CHECK (tone IN ('personal', 'formal', 'urgent')),
  recipients_count INTEGER DEFAULT 0,
  sent_count       INTEGER DEFAULT 0,
  failed_count     INTEGER DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- 4. Admin instructions to Amina
CREATE TABLE IF NOT EXISTS amina_instructions (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id     UUID    REFERENCES users(id) ON DELETE SET NULL,
  instruction  TEXT    NOT NULL,
  scope        TEXT    NOT NULL DEFAULT 'global'
                       CHECK (scope IN ('global', 'phone_specific')),
  phone_number TEXT,                                        -- required when scope = 'phone_specific'
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ws_phone    ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_ws_status   ON whatsapp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ws_updated  ON whatsapp_sessions(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_wm_phone    ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_wm_created  ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wm_phone_created ON whatsapp_messages(phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wb_status   ON whatsapp_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_wb_admin    ON whatsapp_broadcasts(admin_id);

CREATE INDEX IF NOT EXISTS idx_ai_scope    ON amina_instructions(scope, active);
CREATE INDEX IF NOT EXISTS idx_ai_phone    ON amina_instructions(phone_number) WHERE phone_number IS NOT NULL;

-- ── Disable RLS (admin-only tables, accessed via service role) ────────────────

ALTER TABLE whatsapp_sessions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages     DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcasts   DISABLE ROW LEVEL SECURITY;
ALTER TABLE amina_instructions    DISABLE ROW LEVEL SECURITY;

-- ── Enable realtime for admin panel live updates ──────────────────────────────

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
