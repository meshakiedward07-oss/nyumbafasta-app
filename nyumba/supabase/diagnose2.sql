-- ════════════════════════════════════════════════════════════════
-- Diagnose2 — check auth schema for root cause
-- ════════════════════════════════════════════════════════════════

-- 1. Is RLS enabled on auth.users? (if yes, GoTrue cannot query it)
SELECT
  relname,
  relrowsecurity    AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname = 'users'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');

-- 2. Any policies on auth.users?
SELECT policyname, cmd, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'auth' AND tablename = 'users';

-- 3. Triggers on auth.users (all of them)
SELECT tgname, tgenabled,
       (SELECT proname FROM pg_proc WHERE oid = tgfoid) AS function_name
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- 4. Can postgres role SELECT from auth.users?
SELECT COUNT(*) FROM auth.users;

-- 5. Check extensions needed by auth
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pgcrypto', 'pgjwt', 'pgsodium', 'pg_net', 'uuid-ossp');
