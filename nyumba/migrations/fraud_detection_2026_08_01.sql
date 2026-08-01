-- NyumbaFasta — Fraud Detection System
-- Run this in Supabase SQL Editor (Settings → SQL Editor)

-- ── 1. Device sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_sessions (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  fingerprint_hash text        NOT NULL,
  ip_address       text,
  user_agent       text,
  platform         text,
  screen_size      text,
  timezone         text,
  language         text,
  first_seen_at    timestamptz DEFAULT now(),
  last_seen_at     timestamptz DEFAULT now(),
  session_count    int         DEFAULT 1,
  UNIQUE(user_id, fingerprint_hash)
);
CREATE INDEX IF NOT EXISTS idx_device_sessions_fp   ON device_sessions(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON device_sessions(user_id);

-- ── 2. IP activity log ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ip_activity_log (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text        NOT NULL,
  user_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text        NOT NULL,  -- 'register' | 'unlock' | 'login' | 'payment'
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_log_ip      ON ip_activity_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_log_user    ON ip_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_log_created ON ip_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ip_log_event   ON ip_activity_log(event_type);

-- ── 3. Fraud signals ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fraud_signals (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  signal_type      text        NOT NULL,
  -- duplicate_phone | duplicate_device | duplicate_ip | rapid_accounts
  -- rapid_unlocks   | suspicious_payment
  severity         text        NOT NULL DEFAULT 'medium',
  -- low | medium | high | critical
  description      text,
  evidence         jsonb,
  related_user_ids uuid[]      DEFAULT '{}',
  related_ip       text,
  is_resolved      boolean     DEFAULT false,
  resolved_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  resolution_note  text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fraud_user     ON fraud_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_type     ON fraud_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_fraud_severity ON fraud_signals(severity);
CREATE INDEX IF NOT EXISTS idx_fraud_resolved ON fraud_signals(is_resolved);
CREATE INDEX IF NOT EXISTS idx_fraud_created  ON fraud_signals(created_at);

-- ── 4. Extend contact_unlocks ─────────────────────────────────────────────────
ALTER TABLE contact_unlocks ADD COLUMN IF NOT EXISTS msisdn     text;
ALTER TABLE contact_unlocks ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE contact_unlocks ADD COLUMN IF NOT EXISTS user_agent text;
CREATE INDEX IF NOT EXISTS idx_unlocks_msisdn ON contact_unlocks(msisdn) WHERE msisdn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unlocks_ip     ON contact_unlocks(ip_address) WHERE ip_address IS NOT NULL;

-- ── 5. Extend users ───────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS fraud_score int  DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fraud_flags jsonb DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_users_fraud_score ON users(fraud_score) WHERE fraud_score > 0;

-- ── 6. RLS — fraud tables readable only by service role + admins ──────────────
ALTER TABLE device_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_activity_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_signals     ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — no explicit policy needed for service role.
-- Users cannot read fraud tables directly from the client.
