-- ══════════════════════════════════════════════════════════
-- add_delete_and_reports.sql
-- Run once in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 0. Ongeza 'deleted' kwenye listings status CHECK (required by delete function)
ALTER TABLE listings
  DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('pending', 'active', 'taken', 'expired', 'rejected', 'deleted'));

-- 1. Ongeza columns za soft-delete kwenye users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason  TEXT;

-- 2. Function ya kufuta akaunti kamili (SECURITY DEFINER — inaendeshwa kama superuser)
CREATE OR REPLACE FUNCTION public.delete_user_account(
  target_user_id  UUID,
  reason          TEXT    DEFAULT NULL,
  deleted_by_id   UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Futa au archive listings
  UPDATE listings
  SET status = 'deleted'
  WHERE dalali_id = target_user_id
    AND status NOT IN ('deleted');

  -- Futa dalali_profiles
  DELETE FROM dalali_profiles   WHERE user_id   = target_user_id;

  -- Futa subscriptions
  DELETE FROM subscriptions     WHERE dalali_id = target_user_id;

  -- Futa push subscriptions kama zipo
  DELETE FROM push_subscriptions WHERE user_id  = target_user_id;

  -- Futa notifications
  DELETE FROM notifications     WHERE user_id   = target_user_id;

  -- Soft-delete: futa PII, weka is_active = false
  UPDATE public.users
  SET
    deleted_at      = now(),
    deleted_by      = deleted_by_id,
    deletion_reason = reason,
    is_active       = false,
    full_name       = 'Akaunti Iliyofutwa',
    phone           = NULL,
    avatar_url      = NULL,
    email           = NULL
  WHERE id = target_user_id;

  -- Futa kwenye auth.users (inazuia login kabisa)
  DELETE FROM auth.users WHERE id = target_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'delete_user_account failed: %', SQLERRM;
END;
$$;

-- 3. Admin logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  target_id  UUID,
  reason     TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- Admin peke yake anaweza kuona logs
DROP POLICY IF EXISTS "admin_logs_admin_only" ON admin_logs;
CREATE POLICY "admin_logs_admin_only" ON admin_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Reports table (wateja wanaripoti madalali wa scam)
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

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Clients wanaweza kutuma ripoti
DROP POLICY IF EXISTS "reports_client_insert" ON reports;
CREATE POLICY "reports_client_insert" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Admin anaona ripoti zote
DROP POLICY IF EXISTS "reports_admin_all" ON reports;
CREATE POLICY "reports_admin_all" ON reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Client anaona ripoti zake mwenyewe
DROP POLICY IF EXISTS "reports_own_select" ON reports;
CREATE POLICY "reports_own_select" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);
