-- ════════════════════════════════════════════════════════════════════════
-- fix_trial_at_db_trigger_2026_08_27.sql
-- Run in Supabase SQL Editor. Safe to re-run — idempotent.
--
-- Background: even after fix_trial_activation_guarantee_2026_08_22.sql made
-- start_dalali_trial() itself bulletproof (confirmed working when called
-- directly via SQL), NEW real dalali signups today STILL ended up with zero
-- subscription rows. dalali_profiles WAS created for them (proving the app's
-- dalali-setup code block did start running), but somewhere between that and
-- the app's own admin.rpc('start_dalali_trial', ...) call, nothing reached
-- the database — and with Vercel deploys currently blocked (Hobby-plan
-- downgrade, see project memory), the app-layer fixes made earlier today
-- (proper error checking/logging around that RPC call) aren't live yet
-- either, so the exact app-side cause can't be confirmed from logs right
-- now.
--
-- This migration removes the dependency on the Next.js app code entirely
-- for the BASELINE guarantee: handle_new_user() now calls
-- start_dalali_trial() itself, synchronously, inside the same trigger that
-- creates the user row — so a plan is guaranteed the instant the auth.users
-- row is created, regardless of whether any application code afterward
-- runs, succeeds, or is even deployed. The app's own RPC call (once
-- deployed) becomes a redundant no-op via start_dalali_trial()'s own
-- "already has an active subscription" guard — safe to call twice.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_role TEXT;
BEGIN
  safe_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'client');
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = safe_role
  ) THEN
    safe_role := 'client';
  END IF;

  INSERT INTO public.users (
    id, email, phone, full_name, avatar_url, role, is_active, is_verified, account_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'Mtumiaji'
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'picture', '')
    ),
    safe_role::user_role,
    TRUE,
    FALSE,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = COALESCE(public.users.email,      EXCLUDED.email),
    phone        = COALESCE(public.users.phone,      EXCLUDED.phone),
    avatar_url   = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url),
    account_status = COALESCE(public.users.account_status, 'active');

  -- Guarantee a Growth Plan trial the instant a dalali account is created —
  -- independent of any application code running afterward. Wrapped so a
  -- failure here can NEVER block user creation itself.
  IF safe_role = 'dalali' THEN
    BEGIN
      PERFORM public.start_dalali_trial(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[handle_new_user] start_dalali_trial failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never crash — a trigger failure must not block auth.users insert
  RAISE WARNING '[handle_new_user] failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Backfill: guarantee a plan for any dalali who registered before this fix
-- and still has no subscription (covers "Dalali nyumbafasta" and "Mesha
-- dalali" from today's testing, and anyone else in the same state).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT u.id
    FROM users u
    WHERE u.role = 'dalali'
      AND NOT EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.dalali_id = u.id AND s.status IN ('active', 'grace_period')
      )
  LOOP
    PERFORM public.start_dalali_trial(r.id);
  END LOOP;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'fix_trial_at_db_trigger_2026_08_27.sql complete — every dalali now gets a plan at the DB layer, no app code required';
END $$;
