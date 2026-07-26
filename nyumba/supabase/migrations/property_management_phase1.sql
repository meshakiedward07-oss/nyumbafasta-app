-- NyumbaFasta: Property Management System — Phase 1 Foundation
-- Tables: organizations, organization_members, management_agreements,
--         commission_rules, brokerage_commissions, staff_workload,
--         conflict_flags, service_requests, kyc_submissions
-- Alters: listings (add listing_source, lifecycle_status, managing_org_id)
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING throughout

-- ── 1. Organizations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  org_type    text        NOT NULL CHECK (org_type IN ('landlord', 'property_manager', 'firm')),
  description text,
  phone       text,
  email       text,
  logo_url    text,
  region      text,
  district    text,
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'suspended', 'pending')),
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

-- ── 2. Organization Members ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('owner','branch_manager','agent','maintenance_coordinator','accountant')),
  invited_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  joined_at       timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- ── 3. Management Agreements (landlord ↔ managing org) ───────────────────────
CREATE TABLE IF NOT EXISTS management_agreements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  managing_org_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  listing_id      uuid        REFERENCES listings(id) ON DELETE SET NULL,
  scope           text        NOT NULL CHECK (scope IN ('maintenance_only','full_management','staff_assisted_listing')),
  commission_type text        CHECK (commission_type IN ('flat_fee','percent_first_month','percent_annual')),
  commission_value numeric,
  start_date      date,
  end_date        date,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','active','ended','cancelled')),
  document_url    text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ── 4. Commission Rules (NyumbaFasta brokerage fee — configurable) ────────────
CREATE TABLE IF NOT EXISTS commission_rules (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type   text        NOT NULL CHECK (rule_type IN ('flat_fee','percent_first_month','percent_annual')),
  value       numeric     NOT NULL,
  description text,
  active      boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- Seed default rule: 50% of first month's rent
INSERT INTO commission_rules (rule_type, value, description, active)
VALUES ('percent_first_month', 50, 'Asilimia 50 ya kodi ya mwezi wa kwanza (default)', true)
ON CONFLICT DO NOTHING;

-- ── 5. Brokerage Commissions (NyumbaFasta earns on staff-assisted listings) ───
CREATE TABLE IF NOT EXISTS brokerage_commissions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  landlord_id       uuid        NOT NULL REFERENCES users(id),
  staff_id          uuid        REFERENCES users(id),
  rule_id           uuid        REFERENCES commission_rules(id),
  calculated_amount numeric,
  collection_status text        NOT NULL DEFAULT 'pending'
                                CHECK (collection_status IN ('pending','invoiced','collected','overdue')),
  invoice_sent_at   timestamptz,
  collected_at      timestamptz,
  collected_by      uuid        REFERENCES users(id),
  proof_url         text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW()
);

-- ── 6. Staff Workload ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_workload (
  staff_id                  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_managed_properties int  NOT NULL DEFAULT 0,
  max_capacity              int  NOT NULL DEFAULT 15,
  updated_at                timestamptz NOT NULL DEFAULT NOW()
);

-- ── 7. Conflict Flags ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conflict_flags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        REFERENCES listings(id) ON DELETE CASCADE,
  flag_type   text        NOT NULL CHECK (flag_type IN ('existing_dalali_listing','duplicate_service_request')),
  description text,
  resolved    boolean     NOT NULL DEFAULT false,
  resolved_by uuid        REFERENCES users(id),
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- ── 8. Service Requests (landlord requests NyumbaFasta staff help) ────────────
CREATE TABLE IF NOT EXISTS service_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id  uuid        NOT NULL REFERENCES users(id),
  assigned_to  uuid        REFERENCES users(id),
  listing_id   uuid        REFERENCES listings(id),
  request_type text        NOT NULL DEFAULT 'staff_assisted_listing'
                           CHECK (request_type IN ('staff_assisted_listing','kyc_only','management_setup')),
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','assigned','in_progress','completed','cancelled','on_hold')),
  title        text,
  description  text,
  notes        text,
  conflict_flag boolean   NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);

-- ── 9. KYC Submissions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid        NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  landlord_id        uuid        NOT NULL REFERENCES users(id),
  reviewed_by        uuid        REFERENCES users(id),
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','approved','rejected','needs_more_info')),
  id_document_url    text,
  title_deed_url     text,
  tax_cert_url       text,
  notes              text,
  rejection_reason   text,
  submitted_at       timestamptz NOT NULL DEFAULT NOW(),
  reviewed_at        timestamptz
);

-- ── 10. Extend listings table ────────────────────────────────────────────────
-- listing_source: dalali (existing agent) or nyumbafasta_managed (staff-assisted)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listing_source text NOT NULL DEFAULT 'dalali'
  CHECK (listing_source IN ('dalali', 'nyumbafasta_managed'));

-- lifecycle_status: property management lifecycle (independent of approval flow)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'listed'
  CHECK (lifecycle_status IN ('draft','listed','under_offer','leased_managed','ended','relisted'));

-- managing_org_id: organization actively managing this listing
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS managing_org_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- Backfill lifecycle_status from existing status values
UPDATE listings SET lifecycle_status = 'leased_managed' WHERE status = 'taken'   AND lifecycle_status = 'listed';
UPDATE listings SET lifecycle_status = 'ended'           WHERE status = 'expired' AND lifecycle_status = 'listed';

-- ── 11. Performance Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orgs_created_by        ON organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_orgs_type_status       ON organizations(org_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_members_org        ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user       ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agreements_landlord    ON management_agreements(landlord_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_org         ON management_agreements(managing_org_id, status);
CREATE INDEX IF NOT EXISTS idx_agreements_listing     ON management_agreements(listing_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_listing      ON brokerage_commissions(listing_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_landlord     ON brokerage_commissions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_status       ON brokerage_commissions(collection_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_source        ON listings(listing_source);
CREATE INDEX IF NOT EXISTS idx_listings_lifecycle     ON listings(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_listings_managing_org  ON listings(managing_org_id);
CREATE INDEX IF NOT EXISTS idx_service_reqs_landlord  ON service_requests(landlord_id, status);
CREATE INDEX IF NOT EXISTS idx_service_reqs_assigned  ON service_requests(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_kyc_service_req        ON kyc_submissions(service_request_id);
CREATE INDEX IF NOT EXISTS idx_kyc_landlord           ON kyc_submissions(landlord_id, status);
CREATE INDEX IF NOT EXISTS idx_conflict_flags_open    ON conflict_flags(resolved, created_at DESC);

-- ── 12. Row-Level Security ────────────────────────────────────────────────────

ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE management_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_workload       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_flags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submissions      ENABLE ROW LEVEL SECURITY;

-- organizations: members see/edit their org; admin/staff see all
DO $$ BEGIN
  DROP POLICY IF EXISTS "orgs_access" ON organizations;
  CREATE POLICY "orgs_access" ON organizations FOR ALL TO authenticated
    USING (
      created_by = auth.uid()
      OR id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      created_by = auth.uid()
      OR id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;

-- organization_members: members see peers; owners manage
DO $$ BEGIN
  DROP POLICY IF EXISTS "org_members_select" ON organization_members;
  CREATE POLICY "org_members_select" ON organization_members FOR SELECT TO authenticated
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
  DROP POLICY IF EXISTS "org_members_manage" ON organization_members;
  CREATE POLICY "org_members_manage" ON organization_members FOR ALL TO authenticated
    USING (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;

-- management_agreements: landlord sees own; org members see their org's; admin/staff all
DO $$ BEGIN
  DROP POLICY IF EXISTS "agreements_access" ON management_agreements;
  CREATE POLICY "agreements_access" ON management_agreements FOR ALL TO authenticated
    USING (
      landlord_id = auth.uid()
      OR managing_org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      landlord_id = auth.uid()
      OR managing_org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner','branch_manager'))
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;

-- commission_rules: admin only writes; all authenticated can read active rules
DO $$ BEGIN
  DROP POLICY IF EXISTS "commission_rules_read" ON commission_rules;
  CREATE POLICY "commission_rules_read" ON commission_rules FOR SELECT TO authenticated
    USING (active = true OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
  DROP POLICY IF EXISTS "commission_rules_admin" ON commission_rules;
  CREATE POLICY "commission_rules_admin" ON commission_rules FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
END $$;

-- brokerage_commissions: landlord sees own; admin/staff all
DO $$ BEGIN
  DROP POLICY IF EXISTS "brokerage_commissions_read" ON brokerage_commissions;
  CREATE POLICY "brokerage_commissions_read" ON brokerage_commissions FOR SELECT TO authenticated
    USING (
      landlord_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
  DROP POLICY IF EXISTS "brokerage_commissions_admin" ON brokerage_commissions;
  CREATE POLICY "brokerage_commissions_admin" ON brokerage_commissions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));
END $$;

-- staff_workload: admin/staff only
DO $$ BEGIN
  DROP POLICY IF EXISTS "staff_workload_access" ON staff_workload;
  CREATE POLICY "staff_workload_access" ON staff_workload FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));
END $$;

-- conflict_flags: admin/staff only
DO $$ BEGIN
  DROP POLICY IF EXISTS "conflict_flags_access" ON conflict_flags;
  CREATE POLICY "conflict_flags_access" ON conflict_flags FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));
END $$;

-- service_requests: landlord sees own; admin/staff all
DO $$ BEGIN
  DROP POLICY IF EXISTS "service_requests_access" ON service_requests;
  CREATE POLICY "service_requests_access" ON service_requests FOR ALL TO authenticated
    USING (
      landlord_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      landlord_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;

-- kyc_submissions: landlord sees own; admin/staff all
DO $$ BEGIN
  DROP POLICY IF EXISTS "kyc_submissions_access" ON kyc_submissions;
  CREATE POLICY "kyc_submissions_access" ON kyc_submissions FOR ALL TO authenticated
    USING (
      landlord_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    )
    WITH CHECK (
      landlord_id = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
    );
END $$;
