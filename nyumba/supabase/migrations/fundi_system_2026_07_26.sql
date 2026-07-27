-- Phase 14: Fundi (contractor) account system
-- Run this in Supabase SQL Editor

-- Extended profile for users with role='fundi'
CREATE TABLE IF NOT EXISTS fundi_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name    TEXT,
  category         TEXT NOT NULL DEFAULT 'other',
  specialty        TEXT,
  location         TEXT,
  bio              TEXT,
  experience_years INTEGER,
  is_available     BOOLEAN NOT NULL DEFAULT true,
  kyc_status       TEXT NOT NULL DEFAULT 'none'
    CHECK (kyc_status IN ('none', 'pending', 'approved', 'rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KYC document submissions
CREATE TABLE IF NOT EXISTS fundi_kyc (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundi_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL DEFAULT 'other'
    CHECK (document_type IN ('business_licence', 'qualification_certificate', 'national_id', 'other')),
  document_url     TEXT NOT NULL,
  document_name    TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by      UUID REFERENCES users(id),
  reviewed_at      TIMESTAMPTZ,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updates fundi posts on their assigned maintenance jobs
CREATE TABLE IF NOT EXISTS fundi_job_updates (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  fundi_user_id          UUID NOT NULL REFERENCES users(id),
  message                TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link vendor record to fundi user account (one fundi can appear in multiple orgs)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fundi_user_id UUID REFERENCES users(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fundi_profiles_user ON fundi_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_fundi_kyc_user      ON fundi_kyc(fundi_user_id);
CREATE INDEX IF NOT EXISTS idx_fundi_kyc_status    ON fundi_kyc(status);
CREATE INDEX IF NOT EXISTS idx_fundi_job_updates   ON fundi_job_updates(maintenance_request_id);
CREATE INDEX IF NOT EXISTS idx_vendors_fundi_user  ON vendors(fundi_user_id);

-- Verify
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('fundi_profiles','fundi_kyc','fundi_job_updates');
