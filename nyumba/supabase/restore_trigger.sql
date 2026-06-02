-- ════════════════════════════════════════════════════════════════
-- restore_trigger.sql
-- Restores handle_new_user to its proper body after the no-op test.
-- Run in Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Mtumiaji'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Confirm trigger still exists and points to the function
SELECT tgname, tgenabled,
       (SELECT proname FROM pg_proc WHERE oid = tgfoid) AS function_name
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;
