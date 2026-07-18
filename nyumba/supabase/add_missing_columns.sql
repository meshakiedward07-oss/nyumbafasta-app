-- ════════════════════════════════════════════════════════════════
-- add_missing_columns.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- These columns are referenced in code but missing from schema.sql.
-- Safe to re-run — IF NOT EXISTS / IF EXISTS guards prevent errors.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email               TEXT,
  ADD COLUMN IF NOT EXISTS staff_active        BOOLEAN      DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS staff_title         TEXT,
  ADD COLUMN IF NOT EXISTS max_leads_capacity  INTEGER      DEFAULT 500,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS account_status      TEXT         DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS agreement_accepted  BOOLEAN      DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS role_template       TEXT,
  ADD COLUMN IF NOT EXISTS is_verified         BOOLEAN      DEFAULT FALSE;

-- Backfill email from auth.users for all existing users
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id
  AND a.email IS NOT NULL
  AND (u.email IS NULL OR u.email = '');

-- Ensure all admin users are active and have agreement accepted
UPDATE public.users
SET
  is_active         = TRUE,
  staff_active      = TRUE,
  account_status    = 'active',
  agreement_accepted = TRUE
WHERE role = 'admin';

-- Verify
SELECT
  u.role,
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE u.email IS NOT NULL)           AS with_email,
  COUNT(*) FILTER (WHERE u.is_active = TRUE)            AS active,
  COUNT(*) FILTER (WHERE a.email_confirmed_at IS NOT NULL) AS confirmed_in_auth
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
GROUP BY u.role
ORDER BY u.role;
