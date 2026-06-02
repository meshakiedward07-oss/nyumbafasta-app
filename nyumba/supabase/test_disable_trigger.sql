-- ════════════════════════════════════════════════════════════════
-- TEST: Disable trigger to check if it is the cause of
--       "database error querying schema"
--
-- Step 1: Run this file
-- Step 2: Try to login in the app
-- Step 3: Tell me if login works or still fails
-- ════════════════════════════════════════════════════════════════

-- Disable the trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Confirm it is disabled (should show tgenabled = 'D')
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;
