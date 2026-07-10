-- Add business license PDF upload + favourite dalali badge
-- Run this in Supabase SQL editor

ALTER TABLE dalali_profiles
  ADD COLUMN IF NOT EXISTS business_license_url TEXT,
  ADD COLUMN IF NOT EXISTS is_favourite_dalali BOOLEAN NOT NULL DEFAULT FALSE;

-- Revoke direct access to business_license_url from non-admin roles
-- (admin reads it only via service_role through API routes)
REVOKE SELECT (business_license_url) ON dalali_profiles FROM anon, authenticated;
