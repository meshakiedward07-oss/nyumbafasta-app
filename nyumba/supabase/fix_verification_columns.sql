-- Fix verification columns on dalali_profiles
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.dalali_profiles
  ADD COLUMN IF NOT EXISTS nida_number               text,
  ADD COLUMN IF NOT EXISTS nida_image_front          text,
  ADD COLUMN IF NOT EXISTS nida_image_back           text,
  ADD COLUMN IF NOT EXISTS selfie_image              text,
  ADD COLUMN IF NOT EXISTS verification_status       text DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS verification_rejected_reason text;

-- Fix existing rows with wrong 'verified' status (code expects 'approved')
UPDATE public.dalali_profiles
  SET verification_status = 'approved'
  WHERE verification_status = 'verified';

-- RLS: allow admin to read/update dalali_profiles for verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'dalali_profiles'
      AND policyname = 'admin_full_access_dalali_profiles'
  ) THEN
    CREATE POLICY "admin_full_access_dalali_profiles"
      ON public.dalali_profiles
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      );
  END IF;
END $$;
