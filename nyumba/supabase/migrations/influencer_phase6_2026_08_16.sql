-- influencer_phase6_2026_08_16.sql
-- Phase 6: Growth Plan trial lifecycle
--
-- Changes vs the existing system:
--   1. start_dalali_trial: 14 days → 30 days, basic → enterprise
--   2. send_trial_reminders:
--      - Reminder timing updated (3-day, 7-day, last-day → same but updated messages)
--      - At expiry: no longer sets listings to 'pending' (blanket re-approval)
--        Instead: adds a trial_expired notification so the cron JS can pause
--        listings beyond the 2-active free-plan limit with is_sub_suspended=true
--
-- Safe to re-run: CREATE OR REPLACE throughout

-- ── 1. Update start_dalali_trial: 30 days, enterprise tier ──────────────────

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

  -- Skip if already has an active or grace-period subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE dalali_id = dalali_user_id AND status IN ('active', 'grace_period')
      AND is_trial = FALSE
  ) THEN
    RAISE EXCEPTION 'Una subscription active tayari';
  END IF;

  -- Insert 30-day Growth Plan trial at enterprise tier
  INSERT INTO subscriptions (
    dalali_id, plan, status, is_trial,
    trial_started_at, trial_ends_at,
    starts_at, expires_at, amount_paid,
    payment_method, payment_ref
  ) VALUES (
    dalali_user_id, 'enterprise', 'active', TRUE,
    NOW(), NOW() + INTERVAL '30 days',
    NOW(), NOW() + INTERVAL '30 days', 0,
    'trial', 'TRIAL-' || dalali_user_id::TEXT
  );

  -- Mark trial used
  UPDATE dalali_profiles
  SET trial_used = TRUE
  WHERE user_id = dalali_user_id;

EXCEPTION
  WHEN unique_violation THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Trial imeshatolewa%' OR SQLERRM LIKE '%Una subscription%' THEN NULL;
    ELSE RAISE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO service_role;

-- ── 2. Update send_trial_reminders: fix expiry, add upsell notification ──────

CREATE OR REPLACE FUNCTION public.send_trial_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- 7 days remaining
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_reminder_7days',
    '⏰ Siku 7 za Trial Zimebaki',
    'Trial yako ya bure ya siku 30 itaisha siku 7. Chagua plan unayoipenda uendelee kupata wateja!',
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

  -- 3 days remaining
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_reminder_3days',
    '🚨 Siku 3 tu za Trial Zimebaki!',
    'Trial yako itaisha siku 3! Lipa subscription uendelee kuonyesha listings zako kwa wateja.',
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

  -- Last day
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_reminder_last_day',
    '🔴 Leo ni Siku ya Mwisho ya Trial!',
    'Trial yako itaisha leo usiku. Lipa sasa uendelee bila kukatizwa.',
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

  -- Expire trials whose time is up
  UPDATE subscriptions
  SET status = 'trial_expired'
  WHERE is_trial = TRUE
    AND status = 'active'
    AND trial_ends_at < NOW();

  -- Send trial_expired notification (once per dalali) so the cron JS knows to
  -- pause listings beyond the 2-active free plan limit.
  INSERT INTO notifications (user_id, type, title, body, is_read, ref_id)
  SELECT
    s.dalali_id,
    'trial_expired',
    '⚠️ Trial Yako Imekwisha',
    'Trial yako ya siku 30 imekwisha. Listings zaidi ya 2 zimesimamishwa. Lipa subscription kuziwezesha tena.',
    FALSE,
    s.id
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status = 'trial_expired'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_expired'
    );

  -- NOTE: Listing suspension (is_sub_suspended=true for listings beyond 2) is
  -- handled in the daily cron JS (cron/daily/route.ts) after this RPC returns,
  -- because the ranking logic (keep 2 newest, suspend the rest) is easier in JS.

END;
$$;

GRANT EXECUTE ON FUNCTION public.send_trial_reminders() TO service_role;
