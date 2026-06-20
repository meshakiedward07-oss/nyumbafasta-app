-- Add must_change_password flag to users table
-- Run in Supabase SQL Editor BEFORE creating first staff account
-- Date: 2026-06-20

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.must_change_password IS
  'Set to true for staff accounts created by admin. Forces password change on first login.';
