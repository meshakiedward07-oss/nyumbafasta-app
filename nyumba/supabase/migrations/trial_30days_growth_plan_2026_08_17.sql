-- ═══════════════════════════════════════════════════════════════════════════
-- NyumbaFasta — Growth Plan Trial: 30 days + Premium features
-- Date: 2026-08-17
-- Run in Supabase SQL Editor.  Safe to re-run: idempotent throughout.
--
-- SUPERSEDES: influencer_phase6_2026_08_16.sql
--   Phase6 had two bugs: (1) used plan='enterprise' instead of 'premium',
--   (2) set status='trial_expired' which is NOT in the sub_status enum.
--   DO NOT run phase6 — run this file instead.
--
-- Both self-registered AND influencer-referred dalali go through the same
-- register/route.ts → start_dalali_trial path. This ensures they get
-- identical Growth Plan bundles (premium, 30 days).
--
-- Changes:
--   1. start_dalali_trial: 14 → 30 days, plan 'basic' → 'premium' (listings 20)
--   2. send_trial_reminders: updated messages + correct expiry handling
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. start_dalali_trial — 30-day Premium trial ─────────────────────────────
CREATE OR REPLACE FUNCTION public.start_dalali_trial(dalali_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days INT := 30;
BEGIN
  -- Insert a 30-day Growth Plan (premium) trial subscription.
  -- ON CONFLICT: if the dalali already has a subscription, do nothing
  -- (prevents double-trial on retry or re-registration).
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
  )
  VALUES (
    dalali_user_id,
    'premium',
    'active',
    TRUE,
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL,
    0,
    'trial',
    'TRIAL-' || dalali_user_id::TEXT,
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL
  )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO service_role;

-- ── 2. send_trial_reminders — updated windows + messages for 30-day trial ────
CREATE OR REPLACE FUNCTION public.send_trial_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- ── Reminder: 7 days left ──────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, metadata)
  SELECT
    s.dalali_id,
    'trial_reminder_7days',
    '⏰ Growth Plan yako inaisha siku 7',
    'Siku 7 zimebaki kwenye Growth Plan yako ya bure. Chagua plan (Basic au Premium) ili usipoteze listings zako.',
    FALSE,
    jsonb_build_object('trial_ends_at', s.trial_ends_at)
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status   = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '8 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_7days'
    );

  -- ── Reminder: 3 days left ──────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, metadata)
  SELECT
    s.dalali_id,
    'trial_reminder_3days',
    '🚨 Siku 3 zimebaki — Lipa Sasa!',
    'Growth Plan yako inaisha siku 3! Baada ya hapo utarudi kwenye Free Plan (listings 2 tu). Lipa sasa uendelee na Premium.',
    FALSE,
    jsonb_build_object('trial_ends_at', s.trial_ends_at)
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status   = 'active'
    AND s.trial_ends_at BETWEEN NOW() + INTERVAL '2 days' AND NOW() + INTERVAL '4 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_3days'
    );

  -- ── Reminder: last day ────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read, metadata)
  SELECT
    s.dalali_id,
    'trial_reminder_last_day',
    '🔴 Leo ni siku ya mwisho!',
    'Growth Plan yako ya BURE inaisha LEO! Lipa kabla usiku ili listings zako ziendelee kuonekana.',
    FALSE,
    jsonb_build_object('trial_ends_at', s.trial_ends_at)
  FROM subscriptions s
  WHERE s.is_trial = TRUE
    AND s.status   = 'active'
    AND s.trial_ends_at::DATE = NOW()::DATE
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.dalali_id AND n.type = 'trial_reminder_last_day'
    );

  -- ── Expire trials whose 30-day window has passed ──────────────────────────
  UPDATE subscriptions
  SET
    is_trial      = FALSE,
    plan          = 'free',
    status        = 'active',
    trial_ends_at = NULL
  WHERE is_trial    = TRUE
    AND status      = 'active'
    AND trial_ends_at < NOW();

  -- ── Notify dalali that trial ended, now on free plan ──────────────────────
  INSERT INTO notifications (user_id, type, title, body, is_read)
  SELECT
    s.dalali_id,
    'trial_ended_free_plan',
    '📋 Growth Plan ya bure imekwisha',
    'Siku 30 za Growth Plan zimekwisha. Sasa uko kwenye Free Plan (listings 2). Chagua Basic au Premium ili upate listings zaidi na wateja zaidi.',
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

DO $$ BEGIN
  RAISE NOTICE 'trial_30days_growth_plan_2026_08_17.sql complete — start_dalali_trial now gives 30-day premium trial';
END $$;
