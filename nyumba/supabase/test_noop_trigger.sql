-- ════════════════════════════════════════════════════════════════
-- TEST: Replace handle_new_user with a no-op to isolate the error
-- ════════════════════════════════════════════════════════════════

-- Replace the function body with just RETURN NEW (does nothing)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Confirm the replacement worked
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
