-- Run in Supabase Dashboard → SQL Editor
ALTER TABLE public.dalali_profiles
  ADD COLUMN IF NOT EXISTS verification_status varchar(20) DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS nida_number varchar(20),
  ADD COLUMN IF NOT EXISTS nida_image_front text,
  ADD COLUMN IF NOT EXISTS nida_image_back text,
  ADD COLUMN IF NOT EXISTS selfie_image text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_rejected_reason text;
