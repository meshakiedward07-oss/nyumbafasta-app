-- ══════════════════════════════════════════════════════════════════════
-- fix_dalali_onboarding.sql
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- Fixes:
--   1. Gives dalali with NO subscription a free subscription immediately
--   2. Fixes send_trial_reminders to downgrade to free (not suspend)
--
-- NOTE: 'trial_expired' is NOT in the sub_status enum, so no rows
-- can have that status. Fix 1 from the prior version is removed.
-- ══════════════════════════════════════════════════════════════════════

-- ── Fix 1: Give free subscription to dalali who have none ─────────────
-- Covers dalali who registered before the trial system was added,
-- or whose start_dalali_trial RPC call failed silently at signup.
INSERT INTO subscriptions (
  dalali_id, plan, status, is_trial,
  amount_paid, payment_method, payment_ref,
  starts_at, expires_at
)
SELECT
  dp.user_id,
  'free',
  'active',
  FALSE,
  0,
  'free',
  'FREE-' || dp.user_id::TEXT,
  NOW(),
  NULL
FROM dalali_profiles dp
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.dalali_id = dp.user_id
    AND s.status IN ('active', 'grace_period', 'pending')
)
ON CONFLICT DO NOTHING;

-- ── Fix 2: Rewrite send_trial_reminders ───────────────────────────────
-- Changed: expired trials now downgrade to free plan (no suspension,
-- no trial_expired enum value needed).
CREATE OR REPLACE FUNCTION public.send_trial_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- ── Siku 7 zimebaki ─────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_reminder_7days',
    '⏰ Siku 7 za Trial Zimebaki',
    'Trial yako ya bure itaisha siku 7. Upgrade kwenda Basic ili kupata listings zaidi na huduma bora.',
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

  -- ── Siku 3 zimebaki ─────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_reminder_3days',
    '🚨 Siku 3 tu za Trial Zimebaki!',
    'Trial yako itaisha siku 3! Baada ya hapo utakuwa kwenye Free Plan (listings 2).',
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

  -- ── Siku ya mwisho ──────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_reminder_last_day',
    '🔴 Leo ni Siku ya Mwisho ya Trial!',
    'Trial yako itaisha leo. Baada ya hapo utabaki kwenye Free Plan bila kukatizwa.',
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

  -- ── Trial imekwisha: downgrade to free plan (no suspension) ─────────
  UPDATE subscriptions
  SET
    status        = 'active',
    plan          = 'free',
    is_trial      = FALSE,
    expires_at    = NULL,
    trial_ends_at = NULL
  WHERE is_trial = TRUE
    AND status = 'active'
    AND trial_ends_at < NOW();

  -- Notify dalali that trial ended and they are now on free plan
  INSERT INTO notifications (user_id, type, title, body, is_read, data)
  SELECT
    s.dalali_id,
    'trial_ended_free_plan',
    '📋 Trial Imekwisha — Uko kwenye Free Plan',
    'Trial yako ya siku 14 imekwisha. Uko kwenye Free Plan (listings 2). Upgrade ili kupata listings zaidi.',
    FALSE,
    jsonb_build_object('plan', 'free')
  FROM subscriptions s
  WHERE s.is_trial = FALSE
    AND s.plan = 'free'
    AND s.status = 'active'
    AND s.trial_started_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_ended_free_plan'
    );

END;
$$;
