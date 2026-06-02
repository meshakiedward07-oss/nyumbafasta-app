-- ══════════════════════════════════════════════════════════
-- add_free_trial.sql
-- Run once in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Ongeza trial columns kwenye subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS is_trial            BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_converted_at  TIMESTAMPTZ;

-- Allow 'trial_expired' as a valid status
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending', 'active', 'grace_period', 'expired', 'trial_expired', 'cancelled'));

-- 2. Ongeza trial_used kwenye dalali_profiles
ALTER TABLE dalali_profiles
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;

-- 3. Function ya kuanzisha trial ya siku 14 kwa dalali mpya
CREATE OR REPLACE FUNCTION public.start_dalali_trial(dalali_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Angalia hajatumia trial bado
  IF EXISTS (
    SELECT 1 FROM dalali_profiles
    WHERE user_id = dalali_user_id AND trial_used = TRUE
  ) THEN
    RAISE EXCEPTION 'Trial imeshatolewa kwa user huyu';
  END IF;

  -- Angalia hana subscription active tayari
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE dalali_id = dalali_user_id AND status IN ('active', 'grace_period')
  ) THEN
    RAISE EXCEPTION 'Una subscription active tayari';
  END IF;

  -- Anzisha trial ya siku 14
  INSERT INTO subscriptions (
    dalali_id, plan, status, is_trial,
    trial_started_at, trial_ends_at,
    starts_at, expires_at, amount_paid,
    payment_method, payment_ref
  ) VALUES (
    dalali_user_id, 'basic', 'active', TRUE,
    NOW(), NOW() + INTERVAL '14 days',
    NOW(), NOW() + INTERVAL '14 days', 0,
    'trial', 'TRIAL-' || dalali_user_id::TEXT
  );

  -- Mark trial imetumika
  UPDATE dalali_profiles
  SET trial_used = TRUE
  WHERE user_id = dalali_user_id;

EXCEPTION
  WHEN unique_violation THEN
    -- Trial au subscription tayari ipo — ignore silently
    NULL;
END;
$$;

-- 4. Function ya kutuma trial reminders na kuexpire trials zilizokwisha
--    Iitwe kwa cron kila siku (unaweza kutumia pg_cron au external cron)
CREATE OR REPLACE FUNCTION public.send_trial_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- ── Siku 7 zimebaki ───────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_reminder_7days',
    '⏰ Siku 7 za Trial Zimebaki',
    'Trial yako ya bure itaisha siku 7. Lipa Tsh 10,000/mwezi uendelee kupata wateja',
    FALSE,
    jsonb_build_object('trial_ends_at', s.trial_ends_at)
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '8 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_7days'
    );

  -- ── Siku 3 zimebaki ───────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_reminder_3days',
    '🚨 Siku 3 tu za Trial Zimebaki!',
    'Trial yako itaisha siku 3! Lipa sasa usipoteze wateja wako',
    FALSE,
    jsonb_build_object('trial_ends_at', s.trial_ends_at)
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_3days'
    );

  -- ── Siku ya mwisho ────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_reminder_last_day',
    '🔴 Leo ni Siku ya Mwisho ya Trial!',
    'Trial yako itaisha leo usiku. Lipa sasa uendelee bila kukatizwa',
    FALSE,
    jsonb_build_object('trial_ends_at', s.trial_ends_at)
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'active'
    AND s.trial_ends_at::DATE = NOW()::DATE
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_last_day'
    );

  -- ── Expire trials zilizokwisha ────────────────────────
  UPDATE subscriptions
  SET status = 'trial_expired'
  WHERE is_trial = TRUE
    AND status = 'active'
    AND trial_ends_at < NOW();

  -- Suspend listings za expired trial
  UPDATE listings
  SET status = 'pending'
  WHERE dalali_id IN (
    SELECT dalali_id FROM subscriptions
    WHERE is_trial = TRUE AND status = 'trial_expired'
  )
  AND status = 'active';

END;
$$;
