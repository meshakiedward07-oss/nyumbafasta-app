-- =============================================================
-- MICROSITE FIX — 2026-08-17
-- =============================================================
-- Problem 1: is_active was never set during registration, so new
--   dalali returned 404 on /agent/[username] and /dalali/[id].
-- Problem 2: No trigger to keep is_active in sync with account_status.
--
-- Fix: backfill existing rows + add trigger for future changes.
-- =============================================================

-- 1. Backfill: set is_active=true for all users with account_status='active'
--    (safe — only touches rows where is_active is wrong/missing)
UPDATE public.users
SET    is_active = true
WHERE  account_status = 'active'
  AND  (is_active IS NULL OR is_active = false);

-- 2. Backfill: set is_active=false for suspended/banned/pending users
UPDATE public.users
SET    is_active = false
WHERE  account_status IN ('suspended', 'banned', 'pending')
  AND  is_active = true;

-- 3. Trigger function: keep is_active in sync whenever account_status changes
CREATE OR REPLACE FUNCTION public.sync_is_active_from_account_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    NEW.is_active := (NEW.account_status = 'active');
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger (drop first to make this migration idempotent)
DROP TRIGGER IF EXISTS trg_sync_is_active ON public.users;
CREATE TRIGGER trg_sync_is_active
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_is_active_from_account_status();

-- 5. Also fire on INSERT so new users from any path get is_active set correctly
CREATE OR REPLACE FUNCTION public.set_is_active_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set is_active if it wasn't explicitly provided
  IF NEW.is_active IS NULL THEN
    NEW.is_active := (COALESCE(NEW.account_status, 'active') = 'active');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_is_active_insert ON public.users;
CREATE TRIGGER trg_set_is_active_insert
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_is_active_on_insert();
