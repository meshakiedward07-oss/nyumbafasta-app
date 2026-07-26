-- NyumbaFasta: Property Management — Phase 2
-- Units, Leases, Lease Payments
-- Safe to re-run: IF NOT EXISTS throughout

-- ── 1. Property Units (vitengo vya mali) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_units (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id     uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  org_id         uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  unit_number    text        NOT NULL,
  unit_type      text        NOT NULL DEFAULT 'whole'
                             CHECK (unit_type IN ('whole','room','floor','apartment','shop','office')),
  bedrooms       int,
  bathrooms      int,
  floor_number   int,
  monthly_rent   numeric     NOT NULL,
  deposit_months int         NOT NULL DEFAULT 1,
  status         text        NOT NULL DEFAULT 'vacant'
                             CHECK (status IN ('vacant','occupied','maintenance','reserved')),
  description    text,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  updated_at     timestamptz NOT NULL DEFAULT NOW()
);

-- ── 2. Leases (mikataba ya upangaji) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leases (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id            uuid        NOT NULL REFERENCES property_units(id) ON DELETE CASCADE,
  listing_id         uuid        REFERENCES listings(id) ON DELETE SET NULL,
  org_id             uuid        REFERENCES organizations(id) ON DELETE SET NULL,
  tenant_id          uuid        NOT NULL REFERENCES users(id),
  landlord_id        uuid        NOT NULL REFERENCES users(id),
  monthly_rent       numeric     NOT NULL,
  deposit_amount     numeric,
  deposit_paid       boolean     NOT NULL DEFAULT false,
  deposit_paid_at    timestamptz,
  start_date         date        NOT NULL,
  end_date           date,
  status             text        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('draft','active','expired','terminated','renewed')),
  termination_reason text,
  document_url       text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW()
);

-- ── 3. Lease Payments (malipo ya kodi) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS lease_payments (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id       uuid        NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amount_due     numeric     NOT NULL,
  amount_paid    numeric,
  due_date       date        NOT NULL,
  paid_date      date,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','paid','late','partial','waived')),
  payment_method text        CHECK (payment_method IN ('mpesa','cash','bank_transfer','airtel','tigo')),
  reference      text,
  notes          text,
  recorded_by    uuid        REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_units_listing      ON property_units(listing_id);
CREATE INDEX IF NOT EXISTS idx_units_org          ON property_units(org_id);
CREATE INDEX IF NOT EXISTS idx_units_status       ON property_units(status);
CREATE INDEX IF NOT EXISTS idx_leases_unit        ON leases(unit_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant      ON leases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_landlord    ON leases(landlord_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_org         ON leases(org_id, status);
CREATE INDEX IF NOT EXISTS idx_lease_payments_lease ON lease_payments(lease_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_lease_payments_status ON lease_payments(status, due_date DESC);

-- ── 5. Row-Level Security ─────────────────────────────────────────────────────
ALTER TABLE property_units  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_payments  ENABLE ROW LEVEL SECURITY;

-- property_units: org members can see/manage; tenants see their unit; admin/staff all
DO $$ BEGIN
  DROP POLICY IF EXISTS "units_access" ON property_units;
  CREATE POLICY "units_access" ON property_units FOR ALL TO authenticated
    USING (
      org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      OR listing_id IN (SELECT listing_id FROM leases WHERE tenant_id = auth.uid() AND status = 'active')
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
                 AND role IN ('owner','branch_manager','agent'))
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;

-- leases: tenant sees own; org members see org leases; landlord sees own; admin/staff all
DO $$ BEGIN
  DROP POLICY IF EXISTS "leases_access" ON leases;
  CREATE POLICY "leases_access" ON leases FOR ALL TO authenticated
    USING (
      tenant_id = auth.uid()
      OR landlord_id = auth.uid()
      OR org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      landlord_id = auth.uid()
      OR org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
                    AND role IN ('owner','branch_manager','agent'))
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;

-- lease_payments: via lease access
DO $$ BEGIN
  DROP POLICY IF EXISTS "lease_payments_access" ON lease_payments;
  CREATE POLICY "lease_payments_access" ON lease_payments FOR ALL TO authenticated
    USING (
      lease_id IN (
        SELECT id FROM leases
        WHERE tenant_id = auth.uid()
          OR landlord_id = auth.uid()
          OR org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      )
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      lease_id IN (
        SELECT id FROM leases
        WHERE landlord_id = auth.uid()
          OR org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
                        AND role IN ('owner','branch_manager','agent'))
      )
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;
