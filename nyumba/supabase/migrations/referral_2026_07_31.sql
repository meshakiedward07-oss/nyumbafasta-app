-- ── Referral system migration ─────────────────────────────────────────────
-- Run manually in Supabase SQL Editor.

-- 1. Add referral_code to users (auto-generated unique short code)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate codes for existing users who don't have one
UPDATE public.users
SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FOR 6))
WHERE referral_code IS NULL;

-- 2. Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | credited
  reward_days   INT  NOT NULL DEFAULT 7,
  credited_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (referred_id)  -- each new user can only be referred once
);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Dalali can read their own referrals (as referrer)
CREATE POLICY "dalali_read_own_referrals"
  ON public.referrals FOR SELECT
  USING (referrer_id = auth.uid());

-- Service role can do everything
CREATE POLICY "service_role_all_referrals"
  ON public.referrals FOR ALL
  USING (auth.role() = 'service_role');

-- Index for lookups
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_idx ON public.referrals (referred_id);
