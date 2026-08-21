-- ═══════════════════════════════════════════════════════════════════════════
-- fix_growth_plan_trial_2026_08_21.sql
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
--
-- Fixes:
--   1. start_dalali_trial  — was 'basic'/14 days → now 'enterprise'/30 days
--   2. send_trial_reminders — expire logic now downgrades to 'free' plan
--   3. Give existing dalali who have a 'basic' trial a corrected 'enterprise'
--      trial (or give those with no subscription at all a 30-day Enterprise trial)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Replace start_dalali_trial with 30-day Enterprise Growth Plan ─────────
CREATE OR REPLACE FUNCTION public.start_dalali_trial(dalali_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: skip if this dalali already has any active/trial subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE dalali_id = dalali_user_id
      AND status IN ('active', 'grace_period')
  ) THEN
    RETURN;
  END IF;

  INSERT INTO subscriptions (
    dalali_id,
    plan,
    status,
    is_trial,
    trial_started_at,
    trial_ends_at,
    amount_paid,
    payment_method,
    payment_ref,
    starts_at,
    expires_at
  ) VALUES (
    dalali_user_id,
    'enterprise',
    'active',
    TRUE,
    NOW(),
    NOW() + INTERVAL '30 days',
    0,
    'trial',
    'TRIAL-' || dalali_user_id::TEXT,
    NOW(),
    NOW() + INTERVAL '30 days'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO authenticated;

-- ── 2. send_trial_reminders — 30-day messages + downgrade to free on expiry ──
CREATE OR REPLACE FUNCTION public.send_trial_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- Siku 7 zimebaki
  INSERT INTO notifications (user_id, type, title, body, is_read)
  SELECT
    s.dalali_id,
    'trial_reminder_7days',
    '⏰ Growth Plan yako inaisha siku 7',
    'Siku 7 zimebaki kwenye Growth Plan (Enterprise) yako ya bure. Chagua plan inayokufaa ili usipoteze listings zako.',
    FALSE
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status   = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '8 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_7days'
    );

  -- Siku 3 zimebaki
  INSERT INTO notifications (user_id, type, title, body, is_read)
  SELECT
    s.dalali_id,
    'trial_reminder_3days',
    '🚨 Siku 3 zimebaki — Chagua Plan Sasa!',
    'Growth Plan yako inaisha siku 3! Baada ya hapo utarudi kwenye Free Plan (listings 2 tu). Lipa sasa uendelee na huduma kamili.',
    FALSE
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status   = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_3days'
    );

  -- Siku ya mwisho
  INSERT INTO notifications (user_id, type, title, body, is_read)
  SELECT
    s.dalali_id,
    'trial_reminder_last_day',
    '🔴 Leo ni siku ya mwisho ya Growth Plan!',
    'Growth Plan ya BURE inaisha LEO! Lipa kabla usiku ili listings zako ziendelee kuonekana kwa wateja.',
    FALSE
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status   = 'active'
    AND s.trial_ends_at::DATE = NOW()::DATE
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_last_day'
    );

  -- Expire: downgrade to free plan (no suspension)
  UPDATE subscriptions
  SET
    is_trial      = FALSE,
    plan          = 'free',
    status        = 'active',
    expires_at    = NULL,
    trial_ends_at = NULL
  WHERE is_trial    = TRUE
    AND status      = 'active'
    AND trial_ends_at < NOW();

  -- Notify dalali kwamba trial imekwisha
  INSERT INTO notifications (user_id, type, title, body, is_read)
  SELECT
    s.dalali_id,
    'trial_ended_free_plan',
    '📋 Growth Plan ya bure imekwisha',
    'Siku 30 za Growth Plan (Enterprise) zimekwisha. Sasa uko kwenye Free Plan (listings 2). Chagua Basic, Premium au Enterprise ili uendelee kupata wateja wengi zaidi.',
    FALSE
  FROM subscriptions s
  WHERE s.is_trial       = FALSE
    AND s.plan           = 'free'
    AND s.status         = 'active'
    AND s.trial_started_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_ended_free_plan'
    );

END;
$$;

GRANT EXECUTE ON FUNCTION public.send_trial_reminders() TO service_role;

-- ── 3. Fix existing dalali with wrong trial (basic/14days) → enterprise/30days ─
UPDATE subscriptions
SET
  plan          = 'enterprise',
  trial_ends_at = trial_started_at + INTERVAL '30 days',
  expires_at    = trial_started_at + INTERVAL '30 days'
WHERE is_trial  = TRUE
  AND status    = 'active'
  AND plan      = 'basic'
  AND trial_ends_at > NOW();  -- only fix trials still active

-- ── 4. Give dalali with NO subscription a 30-day enterprise trial ─────────────
-- Covers dalali who registered when start_dalali_trial failed silently.
INSERT INTO subscriptions (
  dalali_id, plan, status, is_trial,
  trial_started_at, trial_ends_at,
  amount_paid, payment_method, payment_ref,
  starts_at, expires_at
)
SELECT
  dp.user_id,
  'enterprise',
  'active',
  TRUE,
  NOW(),
  NOW() + INTERVAL '30 days',
  0,
  'trial',
  'TRIAL-' || dp.user_id::TEXT,
  NOW(),
  NOW() + INTERVAL '30 days'
FROM dalali_profiles dp
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.dalali_id = dp.user_id
    AND s.status IN ('active', 'grace_period', 'pending')
)
ON CONFLICT DO NOTHING;

DO $$ BEGIN
  RAISE NOTICE 'fix_growth_plan_trial_2026_08_21.sql complete — enterprise 30-day trial active';
END $$;
