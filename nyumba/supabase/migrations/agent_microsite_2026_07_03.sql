-- ── Dalali Agent Microsite — DB Migration ──────────────────────────────────
-- Adds username + analytics columns to users, and 3 new tracking tables.
-- Run manually in Supabase SQL Editor after deploying the app code.

-- 1. Username + profile analytics columns on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS username_changed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_views_total   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_views_today   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_views_week    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_views_month   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_whatsapp_clicks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_share_count   INTEGER DEFAULT 0;

-- Partial unique index — only indexes rows where username is set
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON public.users (username)
  WHERE username IS NOT NULL;

-- Lower-case username check constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_username_format;
ALTER TABLE public.users
  ADD CONSTRAINT users_username_format
    CHECK (username ~ '^[a-z0-9_]{3,30}$' OR username IS NULL);

-- 2. Profile views table
CREATE TABLE IF NOT EXISTS public.profile_views (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewer_ip    TEXT,
  viewer_session TEXT,
  source       TEXT         DEFAULT 'direct',
  referrer     TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pv_dalali_date
  ON public.profile_views (dalali_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pv_service_full"  ON public.profile_views;
DROP POLICY IF EXISTS "pv_dalali_own"    ON public.profile_views;

CREATE POLICY "pv_service_full" ON public.profile_views
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pv_dalali_own" ON public.profile_views
  FOR SELECT TO authenticated
  USING (dalali_id = auth.uid());

-- 3. Profile click events table
CREATE TABLE IF NOT EXISTS public.profile_click_events (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  dalali_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id   UUID         REFERENCES public.listings(id) ON DELETE SET NULL,
  event_type   TEXT         NOT NULL,
  viewer_session TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pce_dalali_date
  ON public.profile_click_events (dalali_id, created_at DESC);

ALTER TABLE public.profile_click_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pce_service_full" ON public.profile_click_events;
DROP POLICY IF EXISTS "pce_dalali_own"   ON public.profile_click_events;

CREATE POLICY "pce_service_full" ON public.profile_click_events
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "pce_dalali_own" ON public.profile_click_events
  FOR SELECT TO authenticated
  USING (dalali_id = auth.uid());

-- 4. Reserved usernames table
CREATE TABLE IF NOT EXISTS public.reserved_usernames (
  username TEXT PRIMARY KEY,
  reason   TEXT
);

INSERT INTO public.reserved_usernames (username, reason) VALUES
  ('admin',        'system'), ('api',          'system'),
  ('login',        'system'), ('register',     'system'),
  ('signup',       'system'), ('logout',        'system'),
  ('dashboard',    'system'), ('listings',      'system'),
  ('about',        'system'), ('contact',       'system'),
  ('privacy',      'system'), ('terms',         'system'),
  ('help',         'system'), ('support',       'system'),
  ('search',       'system'), ('browse',        'system'),
  ('nyumbafasta',  'brand'),  ('agent',         'system'),
  ('agents',       'system'), ('home',          'system'),
  ('properties',   'system'), ('property',      'system'),
  ('dalali',       'system'), ('mali',          'system'),
  ('saved',        'system'), ('notifications', 'system'),
  ('verify',       'system'), ('auth',          'system')
ON CONFLICT DO NOTHING;

ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ru_service_full"   ON public.reserved_usernames;
DROP POLICY IF EXISTS "ru_public_read"    ON public.reserved_usernames;

CREATE POLICY "ru_service_full" ON public.reserved_usernames
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "ru_public_read" ON public.reserved_usernames
  FOR SELECT USING (true);
