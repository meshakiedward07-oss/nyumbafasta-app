-- ════════════════════════════════════════════════════════════════════════
-- Chatbot Gaps — social_sessions + rate limiting
-- Run in Supabase SQL Editor (not as a transaction — no CONCURRENTLY used)
-- Safe to re-run: all statements are idempotent.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. social_sessions — mirrors whatsapp_sessions for IG/FB ─────────────────
-- Tracks per-sender conversation status: amina | pending | admin | resolved

CREATE TABLE IF NOT EXISTS social_sessions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform           TEXT        NOT NULL,   -- 'instagram' | 'facebook'
  sender_id          TEXT        NOT NULL,   -- platform-internal sender ID
  sender_name        TEXT,
  status             TEXT        NOT NULL DEFAULT 'amina',
  assigned_admin_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  escalation_reason  TEXT,
  escalated_at       TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  last_message_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, sender_id)
);

-- RLS: service_role only (all access via API routes with adminAuth)
ALTER TABLE social_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access social_sessions" ON social_sessions;
CREATE POLICY "Service role full access social_sessions"
  ON social_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ss_platform_sender ON social_sessions(platform, sender_id);
CREATE INDEX IF NOT EXISTS idx_ss_status          ON social_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ss_last_msg        ON social_sessions(last_message_at DESC);

-- ── 2. social_handover_messages — admin replies to IG/FB users ───────────────
-- Stores outbound messages sent by admins during social handover

CREATE TABLE IF NOT EXISTS social_handover_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES social_sessions(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL,   -- 'admin' | 'system'
  content     TEXT        NOT NULL,
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  sent_by     UUID        REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE social_handover_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access social_handover_messages" ON social_handover_messages;
CREATE POLICY "Service role full access social_handover_messages"
  ON social_handover_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shm_session ON social_handover_messages(session_id, sent_at DESC);

-- ── 3. cascade_rate_limits — sliding window per phone/sender ─────────────────
-- Lightweight table for rate limiting. Rows auto-expire via cleanup cron.
-- Each row = one message attempt within the current window.

CREATE TABLE IF NOT EXISTS cascade_rate_limits (
  id          BIGSERIAL   PRIMARY KEY,
  identifier  TEXT        NOT NULL,   -- phone number or social sender_id
  platform    TEXT        NOT NULL,   -- 'whatsapp' | 'instagram' | 'facebook'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cascade_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access cascade_rate_limits" ON cascade_rate_limits;
CREATE POLICY "Service role full access cascade_rate_limits"
  ON cascade_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crl_lookup
  ON cascade_rate_limits(identifier, platform, created_at DESC);

-- RPC: count messages in last N seconds and insert a new record atomically
CREATE OR REPLACE FUNCTION nf_rate_limit_check(
  p_identifier TEXT,
  p_platform   TEXT,
  p_window_sec INT  DEFAULT 60,
  p_max_count  INT  DEFAULT 15
)
RETURNS TABLE (allowed BOOLEAN, current_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count BIGINT;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (p_window_sec || ' seconds')::INTERVAL;

  -- Count requests in window
  SELECT COUNT(*) INTO v_count
  FROM cascade_rate_limits
  WHERE identifier = p_identifier
    AND platform   = p_platform
    AND created_at  > v_cutoff;

  IF v_count < p_max_count THEN
    -- Insert new record (count this request)
    INSERT INTO cascade_rate_limits(identifier, platform) VALUES(p_identifier, p_platform);
    RETURN QUERY SELECT TRUE, v_count + 1;
  ELSE
    RETURN QUERY SELECT FALSE, v_count;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_rate_limit_check(TEXT, TEXT, INT, INT) TO service_role;

-- RPC: clean up old rate limit rows (run via cron every 5 min)
CREATE OR REPLACE FUNCTION nf_rate_limit_cleanup(p_older_than_sec INT DEFAULT 120)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM cascade_rate_limits
  WHERE created_at < NOW() - (p_older_than_sec || ' seconds')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_rate_limit_cleanup(INT) TO service_role;

-- ── 4. English KB articles — mirrors existing Swahili articles ───────────────
-- These allow English-speaking users to get answers from the cascade
-- without needing Amina to translate from scratch every time.

INSERT INTO knowledge_base (slug, title, body, category, language) VALUES

('en-contact-unlock-price', 'How much does it cost to contact a broker?',
'Unlocking a broker''s WhatsApp contact costs Tsh 2,000 per unlock. You pay via M-Pesa, Airtel Money, or Tigo Pesa — no hidden fees. Once you pay, the broker''s number is revealed instantly.',
'pricing', 'en'),

('en-dalali-subscription-pricing', 'Broker subscription plans and pricing',
'Broker plans: Basic Tsh 10,000/month (5 listings), Premium Tsh 25,000/month (20 listings + boost + verified badge + analytics). Payment via M-Pesa, Airtel Money, or Tigo Pesa.',
'pricing', 'en'),

('en-how-to-pay', 'How to pay on NyumbaFasta',
'Pay with M-Pesa, Airtel Money, or Tigo Pesa. Enter your phone number, confirm the STK Push prompt with your PIN. Payment completes instantly.',
'payments', 'en'),

('en-payment-failed', 'My payment failed — what do I do?',
'If your payment failed: (1) Check you have enough balance. (2) Wait 5 minutes and try again. (3) Try a different mobile money number. (4) Contact us on WhatsApp if the problem continues.',
'payments', 'en'),

('en-how-to-register-broker', 'How to register as a broker on NyumbaFasta',
'Registering as a broker is free and quick: (1) Type "I want to be a broker" or choose option 2 on the menu. (2) Enter your full name. (3) Enter your phone number. (4) Enter your working region. (5) Agree to the terms. Your account is created within minutes. Then pay a subscription to start posting.',
'registration', 'en'),

('en-how-to-post-listing', 'How to post a property listing',
'Steps to post a property: (1) Log into your broker account. (2) Choose "Post Property" from the menu. (3) Enter property type, price, location, and description. (4) Upload up to 10 photos. (5) Submit — it will be reviewed by admin within 24 hours.',
'listings', 'en'),

('en-listing-review-time', 'How long does listing review take?',
'Listing review typically takes up to 24 hours, often faster. You will receive a WhatsApp notification when your listing is approved or rejected. If 48 hours pass with no response, contact us.',
'listings', 'en'),

('en-listing-rejected', 'My listing was rejected — why?',
'Common reasons for rejection: photos are unclear, price or description is missing or incomplete, or the listing appears fraudulent. Fix the issues and resubmit. Admin will explain the reason in the notification.',
'listings', 'en'),

('en-get-broker-number', 'How to get a broker''s contact number',
'Tap "Contact Broker" on any listing you like. Pay Tsh 2,000 via mobile money. After payment, the broker''s WhatsApp number is revealed immediately. You can then contact them directly.',
'contact_unlocks', 'en'),

('en-paid-no-number', 'I paid but didn''t receive the broker''s number',
'If you paid but the number wasn''t revealed: (1) Wait 2–3 minutes for payment to process. (2) Refresh the page. (3) Check "Unlocked Properties" in your account. (4) If still missing, contact us with your payment confirmation number.',
'contact_unlocks', 'en'),

('en-forgot-password', 'I forgot my password — what do I do?',
'Click "Forgot Password?" on the login page. Enter your email address. You will receive a link to reset your password. If you don''t know which email you registered with, contact us.',
'account', 'en'),

('en-what-is-nyumbafasta', 'What is NyumbaFasta?',
'NyumbaFasta is a Tanzanian platform that connects people looking for houses or rooms with trusted local brokers. You can search for rooms, apartments, houses, and offices. Brokers post listings; clients pay a small fee to get their contact details.',
'general', 'en'),

('en-is-payment-safe', 'Is my payment safe on NyumbaFasta?',
'Yes. NyumbaFasta uses Selcom''s secure mobile money gateway (M-Pesa, Airtel, Tigo). We never store your PIN or banking details. Every payment has a one-time confirmation prompt.',
'general', 'en'),

('en-search-dar', 'Finding a house or room in Dar es Salaam',
'We have many listings in Dar es Salaam: Kinondoni, Kariakoo, Mikocheni, Mbezi, Sinza, Kijitonyama, Masaki, and more. Tell me the area you want and the type of property and I''ll help you find options.',
'search', 'en'),

('en-regions-available', 'Is NyumbaFasta available in my region?',
'NyumbaFasta has brokers in all 31 regions of Tanzania, including Dar es Salaam, Arusha, Mwanza, Dodoma, Zanzibar, Kilimanjaro, Mbeya, and more. Tell me your region and I''ll show you available brokers.',
'general', 'en'),

('en-need-house-urgently', 'I need a house urgently',
'No problem — I''ll help you find one fast! Tell me: (1) Which area? (2) How many bedrooms? (3) What''s your maximum monthly budget? I''ll connect you with brokers who can help you today.',
'search', 'en'),

('en-contact-support', 'How to contact NyumbaFasta support',
'You can reach us via WhatsApp on this number, or through our website nyumbafasta.co. Working hours: 8am–8pm every day. For urgent issues, we respond as quickly as possible.',
'support', 'en'),

('en-maintenance-request', 'How to submit a maintenance request',
'If you are a tenant with an active lease, you can submit a maintenance request directly from this chat. Just describe the problem (e.g. "leaking tap in the kitchen") and I''ll log it for you. You can also go to the Tenant Portal at nyumbafasta.co/tenant/maintenance.',
'maintenance', 'en'),

('en-view-property', 'How to schedule a property viewing',
'To view a property: (1) Find a listing you like. (2) Unlock the broker''s contact (Tsh 2,000). (3) Message the broker on WhatsApp to arrange a viewing. You can also ask me — just tell me what area and type of property you want to view.',
'viewings', 'en')

ON CONFLICT (slug) DO NOTHING;
