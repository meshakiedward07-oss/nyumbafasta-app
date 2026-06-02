-- ════════════════════════════════════════════════════════════════
-- Nyumba — diagnose.sql
-- Run in Supabase Dashboard → SQL Editor
-- Copy ALL output and share it
-- ════════════════════════════════════════════════════════════════

-- 1. Triggers on auth.users
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- 2. Current handle_new_user function body
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. public.users columns (must match trigger INSERT)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. Does user_role enum exist?
SELECT typname, typtype FROM pg_type WHERE typname = 'user_role';

-- 5. Values inside user_role enum
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;

-- 6. Any other custom triggers on auth.users?
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;
