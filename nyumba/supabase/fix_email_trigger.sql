-- ════════════════════════════════════════════════════════════════
-- fix_email_trigger.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- PROBLEM: The email column was never added to the live public.users table,
-- and the handle_new_user trigger didn't populate it anyway.
-- This broke: cron emails, check-email-status API, etc.
--
-- FIX:
--   1. Add email column (if missing)
--   2. Recreate trigger to populate email from NEW.email
--   3. Backfill all existing users from auth.users
-- ════════════════════════════════════════════════════════════════

-- 1. Add email column (safe — does nothing if it already exists)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update trigger to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, phone, full_name, avatar_url, role, is_active, is_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Mtumiaji'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    TRUE,
    FALSE
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE public.users.email IS NULL;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger (same as before, just ensure it's pointing at updated fn)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill email for ALL existing users from auth.users
--    (column was just added so all rows are NULL — update unconditionally)
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id
  AND a.email IS NOT NULL;

-- 3. Verify the fix — should show 0 users with NULL email (or only OAuth phone users)
SELECT
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS with_email,
  COUNT(*) FILTER (WHERE email IS NULL)     AS without_email,
  COUNT(*)                                  AS total
FROM public.users;
