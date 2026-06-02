-- ════════════════════════════════════════════════════════════════
-- fix_trigger_final.sql  (v2 — imeongezwa avatar_url ya Google)
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Hakikisha columns zote zipo
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Trigger inayoshughulikia email, Google OAuth, na Phone OTP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, phone, full_name, avatar_url, role, is_active, is_verified
  )
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Mtumiaji'
    ),
    -- Google anatoa avatar_url au picture
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    TRUE,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Hakikisha trigger ipo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- 5. Angalia Google users walioingia bila avatar
-- (Run hii kama unataka backfill users waliokuwepo tayari)
-- UPDATE public.users u
-- SET avatar_url = (
--   SELECT raw_user_meta_data->>'avatar_url'
--   FROM auth.users a WHERE a.id = u.id
-- )
-- WHERE avatar_url IS NULL;
