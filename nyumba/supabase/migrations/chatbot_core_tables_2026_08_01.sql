-- ════════════════════════════════════════════════════════════════════════
-- Chatbot Core Tables
-- chat_sessions, chat_messages, pending_listings
-- These are required by lib/chat/aiAgent.ts and were never migrated.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- Run in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. chat_sessions ─────────────────────────────────────────────────────────
-- One row per WhatsApp/IG/FB sender. Tracks which flow they are in and state.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    TEXT        NOT NULL,               -- 'whatsapp' | 'facebook' | 'instagram'
  user_id     TEXT        NOT NULL,               -- phone number (WhatsApp) or sender_id (social)
  phone       TEXT,
  name        TEXT,
  flow_type   TEXT        NOT NULL DEFAULT 'client',   -- 'client' | 'dalali_register' | 'dalali_listing' | 'customer_care'
  flow_step   TEXT        NOT NULL DEFAULT 'greeting',
  flow_data   JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, user_id)
);

-- RLS: service_role only (all access through API routes)
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access chat_sessions" ON chat_sessions;
CREATE POLICY "Service role full access chat_sessions"
  ON chat_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cs_platform_user ON chat_sessions(platform, user_id);
CREATE INDEX IF NOT EXISTS idx_cs_updated       ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_flow_type     ON chat_sessions(flow_type);

-- ── 2. chat_messages ─────────────────────────────────────────────────────────
-- Full message history per session. Used to build conversation context for Amina.

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access chat_messages" ON chat_messages;
CREATE POLICY "Service role full access chat_messages"
  ON chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cm_session_created ON chat_messages(session_id, created_at DESC);

-- ── 3. pending_listings ───────────────────────────────────────────────────────
-- Temporary staging table for listings submitted via WhatsApp chat flow.
-- The listing flow writes here first, then immediately promotes to listings table.

CREATE TABLE IF NOT EXISTS pending_listings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        REFERENCES chat_sessions(id) ON DELETE SET NULL,
  dalali_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  title         TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  price_monthly NUMERIC     NOT NULL DEFAULT 0,
  region        TEXT        NOT NULL DEFAULT '',
  district      TEXT        NOT NULL DEFAULT '',
  description   TEXT        NOT NULL DEFAULT '',
  bedrooms      INTEGER     NOT NULL DEFAULT 1,
  images        TEXT[]      NOT NULL DEFAULT '{}',
  video_url     TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pending_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access pending_listings" ON pending_listings;
CREATE POLICY "Service role full access pending_listings"
  ON pending_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pl_dalali   ON pending_listings(dalali_id);
CREATE INDEX IF NOT EXISTS idx_pl_status   ON pending_listings(status);
CREATE INDEX IF NOT EXISTS idx_pl_created  ON pending_listings(created_at DESC);

-- ── 4. message_classifications ───────────────────────────────────────────────
-- Written by lib/inbox/messageClassifier.ts (saveClassification).
-- Fire-and-forget — its absence caused silent failures in the classifier.

CREATE TABLE IF NOT EXISTS message_classifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      TEXT,                               -- WhatsApp/social message ID
  platform        TEXT        NOT NULL,               -- 'whatsapp' | 'instagram' | 'facebook'
  sender_phone    TEXT,
  sender_name     TEXT,
  sender_id       TEXT,
  message_text    TEXT        NOT NULL,
  message_type    TEXT        NOT NULL DEFAULT 'text',
  category        TEXT        NOT NULL,               -- 'nyumbafasta' | 'personal' | 'spam' | 'unclear'
  confidence      FLOAT       NOT NULL DEFAULT 0,
  reason          TEXT,
  sub_category    TEXT,
  action          TEXT,                               -- 'amina_pending' | 'flagged' | 'ignored'
  auto_reply_sent TEXT,
  flagged_at      TIMESTAMPTZ,
  raw_webhook     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE message_classifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access message_classifications" ON message_classifications;
CREATE POLICY "Service role full access message_classifications"
  ON message_classifications FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mc_platform    ON message_classifications(platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mc_category    ON message_classifications(category);
CREATE INDEX IF NOT EXISTS idx_mc_sender      ON message_classifications(sender_phone) WHERE sender_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mc_flagged     ON message_classifications(flagged_at DESC) WHERE flagged_at IS NOT NULL;

-- ── 5. auto-update updated_at on chat_sessions ────────────────────────────────

CREATE OR REPLACE FUNCTION nf_touch_chat_session()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_session_updated ON chat_sessions;
CREATE TRIGGER trg_chat_session_updated
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION nf_touch_chat_session();
