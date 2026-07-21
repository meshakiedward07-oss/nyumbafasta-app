-- Fix: make handle_new_user trigger include email and use DO UPDATE instead of DO NOTHING
-- Run this in the Supabase SQL editor.
--
-- Why: the old trigger used ON CONFLICT (id) DO NOTHING, which meant:
--   1. If the row already existed with email=NULL, the email was never filled in.
--   2. If a bug caused the trigger to fire after an explicit INSERT (via API code),
--      the explicit row was left with empty email.
--
-- The new version:
--   - Includes email in the INSERT
--   - On conflict, updates only the email if it was previously NULL (safe to call
--     multiple times — won't overwrite data already written by application code)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, phone, full_name, avatar_url, role, is_active, is_verified)
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
  ON CONFLICT (id) DO UPDATE SET
    -- Only fill in missing email — never overwrite data already written by app code
    email = COALESCE(public.users.email, EXCLUDED.email);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but never crash — a trigger failure must not block user creation
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger already exists — recreate it to pick up any changes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
