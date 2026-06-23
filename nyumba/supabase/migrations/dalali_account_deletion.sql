-- Dalali auto-deletion: 90-day rule for accounts with no listings
-- Run manually in Supabase SQL Editor

-- 1. Add columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS listing_deadline_days      INTEGER DEFAULT 90,
  ADD COLUMN IF NOT EXISTS listing_warning_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS listing_warnings_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_listing_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_deletion_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason            TEXT;

-- 2. Warnings log table
CREATE TABLE IF NOT EXISTS dalali_account_warnings (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  warning_type       TEXT NOT NULL,
  days_remaining     INTEGER,
  message_sent       TEXT,
  sent_at            TIMESTAMPTZ DEFAULT NOW(),
  whatsapp_delivered BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_daw_dalali ON dalali_account_warnings(dalali_id);
CREATE INDEX IF NOT EXISTS idx_daw_type   ON dalali_account_warnings(warning_type);

-- 3. Trigger: reset warning counters when dalali posts first listing
CREATE OR REPLACE FUNCTION update_dalali_last_listing()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET
    last_listing_at                = NOW(),
    account_deletion_scheduled_at  = NULL,
    listing_warnings_count         = 0,
    listing_warning_sent_at        = NULL
  WHERE id = NEW.dalali_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_last_listing ON listings;
CREATE TRIGGER trg_update_last_listing
  AFTER INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_dalali_last_listing();

-- 4. Admin view: dalali listing activity
CREATE OR REPLACE VIEW dalali_listing_activity AS
SELECT
  u.id,
  u.full_name                                            AS name,
  au.email,
  u.phone,
  u.created_at                                           AS registered_at,
  u.last_listing_at,
  u.listing_warnings_count,
  u.listing_deadline_days,
  u.account_deletion_scheduled_at,
  u.is_active,
  dp.whatsapp_number,
  s.plan                                                 AS subscription_plan,

  EXTRACT(DAY FROM NOW() - u.created_at)::INTEGER        AS days_since_registration,

  CASE
    WHEN u.last_listing_at IS NOT NULL
    THEN EXTRACT(DAY FROM NOW() - u.last_listing_at)::INTEGER
    ELSE NULL
  END                                                    AS days_since_last_listing,

  COUNT(l.id)                                            AS total_listings_ever,
  COUNT(CASE WHEN l.status = 'active' THEN 1 END)        AS active_listings,

  CASE
    WHEN COUNT(l.id) = 0
    THEN u.listing_deadline_days - EXTRACT(DAY FROM NOW() - u.created_at)::INTEGER
    ELSE NULL
  END                                                    AS days_before_deletion,

  CASE
    WHEN COUNT(l.id) > 0                                         THEN 'safe'
    WHEN EXTRACT(DAY FROM NOW() - u.created_at) <  30           THEN 'new'
    WHEN EXTRACT(DAY FROM NOW() - u.created_at) <  60           THEN 'at_risk'
    WHEN EXTRACT(DAY FROM NOW() - u.created_at) <  85           THEN 'critical'
    ELSE                                                              'overdue'
  END                                                    AS risk_level

FROM users u
LEFT JOIN auth.users au ON au.id = u.id
LEFT JOIN dalali_profiles dp ON dp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT plan FROM subscriptions
  WHERE dalali_id = u.id
    AND status::text IN ('active', 'grace_period', 'trial')
  ORDER BY created_at DESC
  LIMIT 1
) s ON true
LEFT JOIN listings l ON l.dalali_id = u.id
WHERE u.role = 'dalali'
GROUP BY
  u.id, u.full_name, au.email, u.phone, u.created_at,
  u.last_listing_at, u.listing_warnings_count, u.listing_deadline_days,
  u.account_deletion_scheduled_at, u.is_active,
  dp.whatsapp_number, s.plan;
