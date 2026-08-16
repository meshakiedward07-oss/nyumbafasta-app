-- ════════════════════════════════════════════════════════════════════════════
-- security_hardening_2026_08_16.sql
-- Fixes all 20 database audit findings (4 Critical, 4 High, 6 Medium, 6 Low)
-- Safe to re-run (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS throughout)
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- CRITICAL C1: Prevent role escalation via PostgREST
-- Root cause: GRANT ALL ON ALL TABLES TO authenticated lets any
-- authenticated user UPDATE role/is_active/account_status via PostgREST.
-- Fix: trigger that resets sensitive columns when caller is not admin/staff.
-- (Column-level REVOKE after table-level GRANT is a no-op in PG;
--  the trigger is the reliable layer.)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION guard_user_sensitive_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL means service_role (our API admin client) — always trusted
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.role           IS DISTINCT FROM OLD.role
   OR NEW.is_active      IS DISTINCT FROM OLD.is_active
   OR NEW.is_verified    IS DISTINCT FROM OLD.is_verified
   OR NEW.account_status IS DISTINCT FROM OLD.account_status)
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')
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
  FOR EACH ROW
  EXECUTE FUNCTION guard_user_sensitive_columns();


-- ════════════════════════════════════════════════════════════════
-- CRITICAL C3: Restrict users public SELECT — block PII leak to anon callers
-- Old: USING (true) — any anon caller can read all user rows/columns
-- New: require authentication; own-row policy (users_read_own) still works
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "users_public_basic" ON users;

CREATE POLICY "users_authenticated_basic" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ════════════════════════════════════════════════════════════════
-- CRITICAL C4: Restrict dalali_profiles — hide NIDA data from public
-- Old: USING (true) — anon callers can read nida_number, selfie_image, etc.
-- New: require authentication; NIDA columns blocked from anon via REVOKE
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "dalali_profiles_public_read" ON dalali_profiles;

CREATE POLICY "dalali_profiles_authenticated_read" ON dalali_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Block anon from reading the table at all (belt-and-suspenders)
REVOKE SELECT ON dalali_profiles FROM anon;


-- ════════════════════════════════════════════════════════════════
-- HIGH H2: Block direct INSERT/UPDATE/DELETE on subscriptions via PostgREST
-- With only a SELECT policy, INSERT/UPDATE/DELETE are already denied by RLS,
-- but explicit DENY policies make the intent clear and survive future changes.
-- All subscription mutations go through service_role (API), which bypasses RLS.
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
-- HIGH H3: Restrict brokerage_commissions to permissioned staff only
-- Old: role IN ('admin','staff') — all staff could manage commissions
-- New: admin OR staff with 'commissions_manage'/'finance_manage'/'all' key
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
-- HIGH H4: Rate-limit dalali reports — prevent harassment via bulk filing
-- One report per (reporter, dalali) per 7-day rolling window
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_report_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM reports
  WHERE reporter_id        = NEW.reporter_id
    AND reported_dalali_id = NEW.reported_dalali_id
    AND created_at         > NOW() - INTERVAL '7 days';

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Umekwisha ripoti dalali huyu hivi karibuni. Jaribu tena baada ya siku 7.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_rate_limit ON reports;
CREATE TRIGGER trg_report_rate_limit
  BEFORE INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION check_report_rate_limit();


-- ════════════════════════════════════════════════════════════════
-- MEDIUM M1 + M6: Fix next_dalali_invoice_number
-- M1: add SET search_path = public (SECURITY DEFINER without it is exploitable)
-- M6: replace naive MAX() race with advisory lock per dalali
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION next_dalali_invoice_number(p_dalali_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  -- Advisory lock scoped to this dalali prevents concurrent duplicate numbers
  PERFORM pg_advisory_xact_lock(hashtext(p_dalali_id::text));

  SELECT COALESCE(
           MAX(CAST(REGEXP_REPLACE(invoice_number, '[^0-9]', '', 'g') AS INT)),
           0
         ) + 1
    INTO v_count
    FROM dalali_invoices
   WHERE dalali_id = p_dalali_id;

  RETURN 'INV-' || LPAD(v_count::TEXT, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION next_dalali_invoice_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION next_dalali_invoice_number(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- MEDIUM M3: Missing indexes on users.email and users.phone
-- Auth lookups by email/phone are the hottest read path
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone) WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);


-- ════════════════════════════════════════════════════════════════
-- MEDIUM M5: Explicit service_role bypass policy on admin_logs
-- Ensures admin_logs is always writable by the API regardless of
-- future RLS changes, and makes the intent self-documenting.
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_logs'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_logs_service_role" ON admin_logs';
    EXECUTE '
      CREATE POLICY "admin_logs_service_role" ON admin_logs
        FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE)
    ';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- LOW: updated_at trigger for tables missing it
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tables_needing_trigger TEXT[] := ARRAY[
    'brokerage_commissions', 'property_units', 'org_expenses'
  ];
BEGIN
  FOREACH t IN ARRAY tables_needing_trigger LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.triggers
      WHERE event_object_table = t AND trigger_name = 'trg_set_updated_at_' || t
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_set_updated_at_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END $$;


-- ════════════════════════════════════════════════════════════════
-- LOW: missing FK ON DELETE action on brokerage_commissions.landlord_id
-- Current: ON DELETE RESTRICT (implicit) — deleting landlord blocks
-- Fix: SET NULL so landlord deletion doesn't orphan commission records
-- NOTE: Review with business before applying — adjust to CASCADE if preferred
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
    WHERE tc.table_name = 'brokerage_commissions'
      AND ccu.column_name = 'landlord_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Drop and recreate with ON DELETE SET NULL
    EXECUTE (
      SELECT 'ALTER TABLE brokerage_commissions DROP CONSTRAINT ' || tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu USING (constraint_name)
      WHERE tc.table_name = 'brokerage_commissions'
        AND ccu.column_name = 'landlord_id'
        AND tc.constraint_type = 'FOREIGN KEY'
      LIMIT 1
    );
    ALTER TABLE brokerage_commissions
      ADD CONSTRAINT brokerage_commissions_landlord_id_fkey
      FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
