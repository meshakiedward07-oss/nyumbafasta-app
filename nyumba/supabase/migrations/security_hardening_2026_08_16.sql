-- security_hardening_2026_08_16.sql
-- Fixes DB audit findings: C1, C3, C4, H2, H3, H4, M1, M3, M5, M6, LOW items
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS patterns throughout)

-- ════════════════════════════════════════════════════════════════
-- CRITICAL C1: Prevent role escalation via PostgREST column update
-- GRANT ALL ON ALL TABLES TO authenticated gave UPDATE on every column.
-- Revoke sensitive columns from PostgREST roles; service_role retains access.
-- ════════════════════════════════════════════════════════════════

REVOKE UPDATE (role, is_active, is_verified, account_status)
  ON users FROM authenticated, anon;

-- Belt-and-suspenders trigger — blocks changes even if a future GRANT re-enables columns
CREATE OR REPLACE FUNCTION guard_user_sensitive_columns()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service_role sessions: auth.uid() returns NULL — allow unconditionally
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF (NEW.role           IS DISTINCT FROM OLD.role
   OR NEW.is_active      IS DISTINCT FROM OLD.is_active
   OR NEW.is_verified    IS DISTINCT FROM OLD.is_verified
   OR NEW.account_status IS DISTINCT FROM OLD.account_status) THEN
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'staff')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: cannot change role or account status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_sensitive_columns ON users;
CREATE TRIGGER trg_guard_user_sensitive_columns
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_sensitive_columns();


-- ════════════════════════════════════════════════════════════════
-- CRITICAL C3: Stop PII leakage from users table to unauthenticated callers
-- Old policy USING (true) let any anon caller dump full user rows including email/phone
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "users_public_basic" ON users;

-- Anon role loses all direct access to the users table
REVOKE ALL ON users FROM anon;

-- Authenticated callers can see basic info (for dalali cards, org member lists)
CREATE POLICY "users_authenticated_read" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- email + phone hidden from authenticated PostgREST callers; only service_role reads them
REVOKE SELECT (phone, email) ON users FROM authenticated;


-- ════════════════════════════════════════════════════════════════
-- CRITICAL C4: Hide NIDA identity documents from public dalali profiles
-- Old policy USING (true) exposed nida_number + document images to anyone
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "dalali_profiles_public_read" ON dalali_profiles;

REVOKE ALL ON dalali_profiles FROM anon;

CREATE POLICY "dalali_profiles_authenticated_read" ON dalali_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

REVOKE SELECT (nida_number, nida_image_front, nida_image_back, selfie_image)
  ON dalali_profiles FROM authenticated;


-- ════════════════════════════════════════════════════════════════
-- HIGH H2: Block direct INSERT/UPDATE/DELETE on subscriptions
-- Only the payment webhook (service_role) may mutate subscription rows
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "subscriptions_deny_insert" ON subscriptions;
CREATE POLICY "subscriptions_deny_insert" ON subscriptions
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "subscriptions_deny_update" ON subscriptions;
CREATE POLICY "subscriptions_deny_update" ON subscriptions
  FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS "subscriptions_deny_delete" ON subscriptions;
CREATE POLICY "subscriptions_deny_delete" ON subscriptions
  FOR DELETE USING (FALSE);


-- ════════════════════════════════════════════════════════════════
-- HIGH H3: Restrict brokerage_commissions to admins + permissioned staff
-- Old: any staff member had full access; now requires specific permission_key
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "brokerage_commissions_admin" ON brokerage_commissions;

CREATE POLICY "brokerage_commissions_admin" ON brokerage_commissions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'staff')
      AND EXISTS (
        SELECT 1 FROM staff_permissions
        WHERE staff_id = auth.uid()
          AND permission_key IN ('commissions_manage', 'finance_manage', 'all')
      )
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    OR (
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'staff')
      AND EXISTS (
        SELECT 1 FROM staff_permissions
        WHERE staff_id = auth.uid()
          AND permission_key IN ('commissions_manage', 'finance_manage', 'all')
      )
    )
  );


-- ════════════════════════════════════════════════════════════════
-- HIGH H4: Rate-limit reports — prevent mass-report harassment
-- At most 1 report per (reporter_id, reported_dalali_id) per 7 days
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION enforce_report_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM   reports
  WHERE  reporter_id        = NEW.reporter_id
    AND  reported_dalali_id = NEW.reported_dalali_id
    AND  created_at         > NOW() - INTERVAL '7 days';

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Umekwisha ripoti dalali huyu hivi karibuni. Jaribu tena baada ya siku 7.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_rate_limit ON reports;
CREATE TRIGGER trg_report_rate_limit
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION enforce_report_rate_limit();


-- ════════════════════════════════════════════════════════════════
-- MEDIUM M1 + M6: Fix next_dalali_invoice_number()
--   M1: Add SET search_path = public (prevents search_path injection)
--   M6: Add advisory lock to eliminate invoice-number race condition
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION next_dalali_invoice_number(p_dalali_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next INT;
BEGIN
  -- Lock scoped to this dalali: prevents two concurrent calls from
  -- reading the same MAX and producing a duplicate invoice number.
  PERFORM pg_advisory_xact_lock(hashtext(p_dalali_id::text));

  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INT)),
    0
  ) + 1
    INTO v_next
    FROM dalali_invoices
   WHERE dalali_id = p_dalali_id;

  RETURN 'INV-' || LPAD(v_next::TEXT, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_dalali_invoice_number(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- MEDIUM M3: Missing indexes on high-cardinality lookup columns
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users (phone) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users (role);

CREATE INDEX IF NOT EXISTS idx_users_account_status
  ON users (account_status) WHERE account_status IS NOT NULL;


-- ════════════════════════════════════════════════════════════════
-- MEDIUM M5: Explicit service_role bypass for admin_logs
-- service_role bypasses RLS by default, but an explicit policy
-- documents intent and survives future RLS mode changes.
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_logs'
  ) THEN
    DROP POLICY IF EXISTS "admin_logs_service_role" ON admin_logs;
    EXECUTE $p$
      CREATE POLICY "admin_logs_service_role" ON admin_logs
        FOR ALL USING     (auth.uid() IS NULL)
        WITH CHECK (auth.uid() IS NULL);
    $p$;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- LOW: brokerage_commissions.landlord_id — add ON DELETE SET NULL
-- Without a referential action, deleting a user leaves orphan rows
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE con_name TEXT;
BEGIN
  -- Only proceed if the column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'brokerage_commissions' AND column_name = 'landlord_id'
  ) THEN RETURN; END IF;

  -- Drop old FK if it exists (no ON DELETE clause)
  SELECT constraint_name INTO con_name
  FROM   information_schema.table_constraints
  WHERE  table_name = 'brokerage_commissions'
    AND  constraint_type = 'FOREIGN KEY'
    AND  constraint_name ILIKE '%landlord%'
  LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE brokerage_commissions DROP CONSTRAINT ' || quote_ident(con_name);
  END IF;

  ALTER TABLE brokerage_commissions
    ADD CONSTRAINT brokerage_commissions_landlord_id_fkey
    FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN NULL;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- LOW: Add updated_at to tables missing it
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['contact_unlocks', 'reports', 'saved_listings'] LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Add column if missing
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = t AND column_name = 'updated_at'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()', t);
      END IF;
      -- Attach auto-update trigger
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_touch_updated_at ON %I;
         CREATE TRIGGER trg_touch_updated_at
           BEFORE UPDATE ON %I
           FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
        t, t
      );
    END IF;
  END LOOP;
END;
$$;
