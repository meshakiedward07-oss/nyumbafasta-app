-- ═══════════════════════════════════════════════════════════════════════════
-- fix_trial_activation_guarantee_2026_08_22.sql
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run)
-- Safe to re-run (all idempotent).
--
-- Problem: new dalali were shown "🎉 Growth Plan ya BURE — Siku 30!" even when
-- start_dalali_trial() had failed to insert a subscriptions row (e.g. because
-- fix_growth_plan_trial_2026_08_21.sql, which defines that function, was never
-- run against this database — the RPC call then errors with "function does
-- not exist", the error is logged but not surfaced, and the welcome
-- notification fires unconditionally regardless). Net effect: dalali ended up
-- with NO subscription row at all, so listing-limit checks fell back to 0.
--
-- Fix:
--   1. Widen the plan CHECK constraint (idempotent — no-op if already applied)
--   2. Redefine start_dalali_trial() so the Enterprise insert is wrapped in its
--      own EXCEPTION handler — if it fails for ANY reason, it falls back to
--      granting a plain Free plan instead of leaving the dalali with nothing.
--   3. Backfill every existing dalali who currently has no active subscription
--      row by calling the (now guaranteed-safe) function for each of them.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Make sure the plan column accepts all four plans ─────────────────────
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'basic', 'premium', 'enterprise'));

-- ── 2. start_dalali_trial — guaranteed to leave a subscription row behind ───
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

  BEGIN
    INSERT INTO subscriptions (
      dalali_id, plan, status, is_trial,
      trial_started_at, trial_ends_at,
      amount_paid, payment_method, payment_ref,
      starts_at, expires_at
    ) VALUES (
      dalali_user_id, 'enterprise', 'active', TRUE,
      NOW(), NOW() + INTERVAL '30 days',
      0, 'trial', 'TRIAL-' || dalali_user_id::TEXT,
      NOW(), NOW() + INTERVAL '30 days'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never leave a dalali with zero plan — grant Free instead of failing silently.
    RAISE WARNING 'start_dalali_trial: enterprise insert failed for %, falling back to free — %', dalali_user_id, SQLERRM;
    INSERT INTO subscriptions (
      dalali_id, plan, status, is_trial,
      starts_at, expires_at, amount_paid, payment_method, payment_ref
    ) VALUES (
      dalali_user_id, 'free', 'active', FALSE,
      NOW(), '2099-12-31'::timestamptz, 0, 'trial_fallback', 'FREE-' || dalali_user_id::TEXT
    );
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_dalali_trial(UUID) TO authenticated;

-- ── 3. send_trial_reminders — called daily by /api/v1/cron/daily. Re-defined ─
--      here too in case fix_growth_plan_trial_2026_08_21.sql was never run,
--      so the function actually exists with the correct 30-day/Enterprise copy.
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

-- ── 4. Backfill every dalali currently stuck with no subscription at all ────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT dp.user_id
    FROM dalali_profiles dp
    WHERE NOT EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.dalali_id = dp.user_id
        AND s.status IN ('active', 'grace_period')
    )
  LOOP
    PERFORM public.start_dalali_trial(r.user_id);
  END LOOP;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'fix_trial_activation_guarantee_2026_08_22.sql complete — every dalali now has an active plan';
END $$;
