-- WhatsApp conversation log + deduplication
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT       NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  message_id  TEXT        UNIQUE,          -- WA message id for deduplication
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_phone    ON whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_created  ON whatsapp_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_id        ON whatsapp_conversations(message_id) WHERE message_id IS NOT NULL;

-- Disable RLS (service role access only — server-side)
ALTER TABLE whatsapp_conversations DISABLE ROW LEVEL SECURITY;

-- Auto-delete messages older than 90 days (keep table lean)
-- Run as a scheduled job or cron:
-- DELETE FROM whatsapp_conversations WHERE created_at < NOW() - INTERVAL '90 days';

COMMENT ON TABLE whatsapp_conversations IS 'WhatsApp Business API conversation log and message deduplication store';
COMMENT ON COLUMN whatsapp_conversations.message_id IS 'WhatsApp message_id — UNIQUE constraint prevents double-processing';
