-- ══════════════════════════════════════════════════════════════════════════════
-- fix_auth_sync_2026_08_22.sql
-- Run in Supabase → SQL Editor
--
-- Supersedes fix_auth_sync_2026_07_25.sql, which failed when run as-is:
--   ERROR: 22P02: invalid input value for enum user_role: "fundi"
-- Root cause: app/fundi/register/page.tsx sets user_metadata.role='fundi' at
-- signup, but 'fundi' was never added to the user_role enum (only 'staff' was,
-- in a past migration) — so any fundi signup's trigger-driven public.users
-- insert silently failed (caught by the EXCEPTION handler), leaving fundi
-- users with NO public.users row at all — the exact "orphaned auth user" bug
-- this whole migration exists to fix, just for a role nobody had widened the
-- enum for yet. Every OTHER portal type (org_owner, tenant) avoids this by
-- deliberately setting role='client' + a separate portal_type field — fundi
-- didn't follow that convention, and fundi is significant enough (own
-- dashboard/subscription/KYC, like dalali) to deserve its own enum value
-- rather than being squeezed under 'client'.
--
-- IMPORTANT: run in TWO separate query executions in the SQL Editor, not one
-- paste. Postgres forbids using a brand-new enum value in the same
-- transaction it was added in ("unsafe use of new value of enum type"), and
-- the SQL Editor runs each submitted query as one transaction. So:
--   1st run: just the STEP 0 statement (ALTER TYPE ... ADD VALUE 'fundi')
--   2nd run: everything from STEP 1 down to the end
--
-- Safe to run multiple times — all statements are idempotent.
--
-- What this does:
--   0. Widen user_role enum to include 'fundi' (the actual, direct root cause)
--   1. Rebuild handle_new_user trigger — bulletproof for email, phone OTP,
--      Google OAuth, AND any future role value nobody widened the enum for
--      yet (falls back to 'client' instead of crashing)
--   2. Backfill every auth.users that has no public.users row
--   3. Sync missing email / avatar_url / account_status for existing rows
--   4. Ensure all dalali users have a dalali_profiles row
--   5. Ensure the admin account is always role='admin' and active
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0: Widen the enum — the actual root cause of the error you hit
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'fundi';

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Rebuild handle_new_user trigger
-- Fires on EVERY auth signup: email+password, phone OTP, Google OAuth, magic link
-- Also future-proofed: if user_metadata.role is ever something NOT in the
-- user_role enum (a portal type nobody's widened the enum for), it now falls
-- back to 'client' instead of crashing and silently orphaning the signup.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  safe_role TEXT;
BEGIN
  -- Only trust the metadata role if it's actually a valid user_role enum
  -- label right now — otherwise fall back to 'client'. This makes the
  -- trigger immune to any future signup flow that sets an as-yet-unadded
  -- role value (exactly what happened with 'fundi').
  safe_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'client');
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = safe_role
  ) THEN
    safe_role := 'client';
  END IF;

  INSERT INTO public.users (
    id,
    email,
    phone,
    full_name,
    avatar_url,
    role,
    is_active,
    is_verified,
    account_status
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
    -- Only fill in fields that are currently NULL — never overwrite real data
    email        = COALESCE(public.users.email,      EXCLUDED.email),
    phone        = COALESCE(public.users.phone,      EXCLUDED.phone),
    avatar_url   = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url),
    -- Ensure account_status is always set
    account_status = COALESCE(public.users.account_status, 'active');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never crash — a trigger failure must not block auth.users insert
  RAISE WARNING '[handle_new_user] failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Backfill — create public.users for every auth.users that is missing one
-- Same enum-safety fallback as the trigger above.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.users (
  id,
  email,
  phone,
  full_name,
  avatar_url,
  role,
  is_active,
  is_verified,
  account_status
)
SELECT
  au.id,
  au.email,
  au.phone,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(COALESCE(au.email, ''), '@', 1), ''),
    'Mtumiaji'
  ),
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(au.raw_user_meta_data->>'picture', '')
  ),
  (CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'user_role'
        AND e.enumlabel = COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'client')
    )
    THEN COALESCE(NULLIF(au.raw_user_meta_data->>'role', ''), 'client')
    ELSE 'client'
  END)::user_role,
  TRUE,
  FALSE,
  'active'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Sync missing fields for existing public.users rows
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. Fill in NULL email from auth.users
UPDATE public.users pu
SET email = au.email
FROM auth.users au
WHERE pu.id = au.id
  AND pu.email IS NULL
  AND au.email IS NOT NULL;

-- 3b. Fill in NULL phone from auth.users
UPDATE public.users pu
SET phone = au.phone
FROM auth.users au
WHERE pu.id = au.id
  AND pu.phone IS NULL
  AND au.phone IS NOT NULL;

-- 3c. Fill in NULL avatar_url from OAuth metadata
UPDATE public.users pu
SET avatar_url = COALESCE(
  NULLIF(au.raw_user_meta_data->>'avatar_url', ''),
  NULLIF(au.raw_user_meta_data->>'picture', '')
)
FROM auth.users au
WHERE pu.id = au.id
  AND pu.avatar_url IS NULL
  AND COALESCE(
    au.raw_user_meta_data->>'avatar_url',
    au.raw_user_meta_data->>'picture'
  ) IS NOT NULL;

-- 3d. Fix NULL account_status (column added after initial schema)
UPDATE public.users
SET account_status = CASE
  WHEN is_active = FALSE THEN 'suspended'
  ELSE 'active'
END
WHERE account_status IS NULL;

-- 3e. Fix empty full_name
UPDATE public.users pu
SET full_name = COALESCE(
  NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
  NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
  NULLIF(split_part(COALESCE(au.email, ''), '@', 1), ''),
  'Mtumiaji'
)
FROM auth.users au
WHERE pu.id = au.id
  AND (pu.full_name IS NULL OR TRIM(pu.full_name) = '');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Ensure every dalali user has a dalali_profiles row
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.dalali_profiles (
  user_id,
  whatsapp_number,
  bio,
  rating_avg,
  rating_count,
  is_premium_verified,
  trial_used
)
SELECT
  pu.id,
  COALESCE(pu.phone, ''),
  NULL,
  0,
  0,
  FALSE,
  FALSE
FROM public.users pu
WHERE pu.role = 'dalali'
  AND NOT EXISTS (
    SELECT 1 FROM public.dalali_profiles dp WHERE dp.user_id = pu.id
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Guarantee admin account is always role='admin' and active
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.users pu
SET
  role           = 'admin'::user_role,
  is_active      = TRUE,
  account_status = 'active'
FROM auth.users au
WHERE pu.id = au.id
  AND au.email = 'meshakiedward07@gmail.com';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Verify — show a summary of what exists
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  'auth.users total'      AS label, COUNT(*)::text AS count FROM auth.users
UNION ALL
SELECT
  'public.users total',   COUNT(*)::text FROM public.users
UNION ALL
SELECT
  'orphaned auth (no public.users row)',
  COUNT(*)::text
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
UNION ALL
SELECT
  'users with NULL email', COUNT(*)::text FROM public.users WHERE email IS NULL
UNION ALL
SELECT
  'users with NULL account_status', COUNT(*)::text FROM public.users WHERE account_status IS NULL
UNION ALL
SELECT
  'dalali without profile', COUNT(*)::text
  FROM public.users pu
  WHERE pu.role = 'dalali'
    AND NOT EXISTS (SELECT 1 FROM public.dalali_profiles dp WHERE dp.user_id = pu.id)
UNION ALL
SELECT
  'fundi users total', COUNT(*)::text FROM public.users WHERE role = 'fundi'
UNION ALL
SELECT
  'admin account status',
  CONCAT('role=', role, ' active=', is_active::text, ' status=', account_status)
  FROM public.users WHERE email = 'meshakiedward07@gmail.com';
