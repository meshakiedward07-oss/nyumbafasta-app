-- ══════════════════════════════════════════════════════════════════
-- fix_missing_columns_and_rpcs.sql
-- Run once in Supabase SQL Editor
-- Fixes:
--   1. dalali_profiles.updated_at column missing (trigger exists without column)
--   2. start_dalali_trial() RPC not deployed
-- ══════════════════════════════════════════════════════════════════

-- 1. Add missing updated_at column to dalali_profiles
--    (the trigger dalali_profiles_updated_at already exists and references this column)
--    This also fixes POST /reviews which updates dalali_profiles.rating_avg/rating_count
ALTER TABLE dalali_profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Re-create trigger (safe — drops first)
DROP TRIGGER IF EXISTS dalali_profiles_updated_at ON dalali_profiles;
CREATE TRIGGER dalali_profiles_updated_at
  BEFORE UPDATE ON dalali_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Create start_dalali_trial() RPC
CREATE OR REPLACE FUNCTION public.start_dalali_trial(dalali_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if trial already used
  IF EXISTS (
    SELECT 1 FROM dalali_profiles
    WHERE user_id = dalali_user_id AND trial_used = TRUE
  ) THEN
    RAISE EXCEPTION 'Trial imeshatolewa kwa user huyu';
  END IF;

  -- Skip if already has an active subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE dalali_id = dalali_user_id AND status IN ('active', 'grace_period')
  ) THEN
    RAISE EXCEPTION 'Una subscription active tayari';
  END IF;

  -- Insert 14-day trial subscription
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

  -- Mark trial used
  UPDATE dalali_profiles
  SET trial_used = TRUE
  WHERE user_id = dalali_user_id;

EXCEPTION
  WHEN unique_violation THEN NULL; -- Already exists — ignore
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Trial imeshatolewa%' OR SQLERRM LIKE '%Una subscription%' THEN NULL;
    ELSE RAISE;
    END IF;
END;
$$;

-- Grant execute to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO service_role;

-- 3. Fix send_trial_reminders() — remove references to non-existent notifications.data column
CREATE OR REPLACE FUNCTION public.send_trial_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- Siku 7 zimebaki
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_reminder_7days',
    '⏰ Siku 7 za Trial Zimebaki',
    'Trial yako ya bure itaisha siku 7. Lipa Tsh 10,000/mwezi uendelee kupata wateja',
    FALSE,
    s.id
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '8 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_7days'
    );

  -- Siku 3 zimebaki
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_reminder_3days',
    '🚨 Siku 3 tu za Trial Zimebaki!',
    'Trial yako itaisha siku 3! Lipa sasa usipoteze wateja wako',
    FALSE,
    s.id
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_3days'
    );

  -- Siku ya mwisho
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_reminder_last_day',
    '🔴 Leo ni Siku ya Mwisho ya Trial!',
    'Trial yako itaisha leo usiku. Lipa sasa uendelee bila kukatizwa',
    FALSE,
    s.id
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'active'
    AND s.trial_ends_at::DATE = NOW()::DATE
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_last_day'
    );

  -- Expire trials zilizokwisha
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
