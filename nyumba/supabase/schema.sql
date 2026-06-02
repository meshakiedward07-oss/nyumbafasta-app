-- Nyumba App – Full Schema
-- Run in Supabase SQL Editor (in order: schema → fix_permissions → rls_policies)

-- ── users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  phone       TEXT,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'dalali', 'admin')),
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-insert user row on auth signup (works for email, Google OAuth, phone)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name, avatar_url, role, is_active, is_verified)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Mtumiaji'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    TRUE,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── dalali_profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dalali_profiles (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_number              TEXT NOT NULL DEFAULT '',
  bio                          TEXT,
  rating_avg                   NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count                 INTEGER NOT NULL DEFAULT 0,
  is_premium_verified          BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status          TEXT DEFAULT 'unverified'
                                 CHECK (verification_status IN ('unverified','pending','approved','rejected')),
  nida_number                  TEXT,
  nida_image_front             TEXT,
  nida_image_back              TEXT,
  selfie_image                 TEXT,
  verification_submitted_at    TIMESTAMPTZ,
  verification_rejected_reason TEXT,
  trial_used                   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── subscriptions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dalali_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                 TEXT NOT NULL CHECK (plan IN ('basic', 'premium')),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN (
                           'pending', 'active', 'expired', 'cancelled',
                           'grace_period', 'trial_expired', 'suspended'
                         )),
  amount_paid          INTEGER NOT NULL DEFAULT 0,
  payment_method       TEXT,
  payment_ref          TEXT,
  starts_at            TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  grace_period_until   TIMESTAMPTZ,
  is_trial             BOOLEAN NOT NULL DEFAULT FALSE,
  trial_started_at     TIMESTAMPTZ,
  trial_ends_at        TIMESTAMPTZ,
  trial_converted_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── listings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dalali_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL CHECK (type IN ('chumba', 'apartment', 'nyumba', 'studio')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'taken', 'expired', 'rejected', 'deleted')),
  price_monthly INTEGER NOT NULL,
  district      TEXT NOT NULL DEFAULT '',
  region        TEXT NOT NULL DEFAULT '',
  furnished     TEXT NOT NULL DEFAULT 'empty' CHECK (furnished IN ('furnished', 'semi', 'empty')),
  amenities     TEXT[] NOT NULL DEFAULT '{}',
  images        TEXT[] NOT NULL DEFAULT '{}',
  description   TEXT,
  bedrooms      INTEGER,
  is_boosted    BOOLEAN NOT NULL DEFAULT FALSE,
  view_count    INTEGER NOT NULL DEFAULT 0,
  lead_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS listings_updated_at ON listings;
CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── contact_unlocks ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_unlocks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id           UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  dalali_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_paid          INTEGER NOT NULL DEFAULT 2000,
  payment_method       TEXT,
  payment_ref          TEXT,
  transid              TEXT,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  client_notes         TEXT,
  last_interaction_at  TIMESTAMPTZ,
  interaction_count    INTEGER NOT NULL DEFAULT 1,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── reviews ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_id   UUID NOT NULL UNIQUE REFERENCES contact_unlocks(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dalali_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── saved_listings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_listings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

-- ── notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  send_at    TIMESTAMPTZ,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── recently_viewed ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recently_viewed (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

-- ── push_subscriptions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── boost_payments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boost_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  dalali_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         INTEGER NOT NULL,
  weeks          INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('pending', 'completed', 'failed')),
  payment_method TEXT,
  payment_ref    TEXT,
  boosted_from   TIMESTAMPTZ,
  boosted_until  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── admin_logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  target_id  UUID,
  reason     TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── reports ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_dalali_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id          UUID REFERENCES listings(id) ON DELETE SET NULL,
  reason              VARCHAR(100) NOT NULL,
  details             TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RPC: increment_view_count ──────────────────────────────
CREATE OR REPLACE FUNCTION increment_view_count(listing_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE listings SET view_count = view_count + 1 WHERE id = listing_id;
END;
$$;

-- ── RPC: increment_lead_count ──────────────────────────────
CREATE OR REPLACE FUNCTION increment_lead_count(listing_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE listings SET lead_count = lead_count + 1 WHERE id = listing_id;
END;
$$;
