-- ============================================================
-- Brokerage System — NyumbaFasta acts as broker for Org listings
-- Run this in Supabase SQL Editor
-- 2026-07-27
-- ============================================================

-- ── 1. Platform broker flag on dalali_profiles ──────────────
-- Create one special dalali account in Supabase Auth, then run:
--   UPDATE dalali_profiles SET is_platform_broker = true, broker_whatsapp = '+255XXXXXXXXX'
--   WHERE user_id = '<special-account-uuid>';

ALTER TABLE dalali_profiles
  ADD COLUMN IF NOT EXISTS is_platform_broker BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS broker_whatsapp    TEXT;

-- ── 2. Link listings back to a brokerage request ────────────
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS brokerage_request_id UUID;

-- ── 3. brokerage_requests table ─────────────────────────────
-- Status flow:  pending → approved | rejected → listed → deal_closed | cancelled
-- Commission:   pending → invoiced → received | waived

CREATE TABLE IF NOT EXISTS brokerage_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  org_id           UUID NOT NULL REFERENCES organizations(id)   ON DELETE CASCADE,
  unit_id          UUID          REFERENCES property_units(id)  ON DELETE SET NULL,
  submitted_by     UUID NOT NULL REFERENCES users(id),

  -- Listing card (org fills same fields as dalali add-listing)
  title            TEXT    NOT NULL,
  listing_type     TEXT    NOT NULL DEFAULT 'apartment',
  description      TEXT,
  price_monthly    INTEGER NOT NULL,
  deposit_months   INTEGER NOT NULL DEFAULT 1,
  bedrooms         INTEGER,
  furnished        TEXT    NOT NULL DEFAULT 'empty',
  region           TEXT    NOT NULL,
  district         TEXT    NOT NULL,
  ward             TEXT,
  mtaa             TEXT,
  amenities        TEXT[]  NOT NULL DEFAULT '{}',
  images           TEXT[]  NOT NULL DEFAULT '{}',

  -- Org's contact for this property (auto-filled from org profile)
  org_contact_name  TEXT,
  org_contact_phone TEXT NOT NULL,

  -- Agreement
  agreed_broker_terms BOOLEAN NOT NULL DEFAULT false,
  agreed_commission   BOOLEAN NOT NULL DEFAULT false,
  commission_amount   INTEGER NOT NULL DEFAULT 0,   -- = price_monthly (1 month)
  agreed_at           TIMESTAMPTZ,

  -- Status
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','listed','deal_closed','cancelled')),
  rejection_reason  TEXT,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,

  -- After staff posts the listing
  listing_id        UUID REFERENCES listings(id)    ON DELETE SET NULL,
  posted_by         UUID REFERENCES users(id),
  posted_at         TIMESTAMPTZ,

  -- Deal tracking
  deal_closed_at    TIMESTAMPTZ,
  tenant_user_id    UUID REFERENCES users(id),

  -- Commission tracking
  commission_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (commission_status IN ('pending','invoiced','received','waived')),
  commission_invoiced_at       TIMESTAMPTZ,
  commission_received_at       TIMESTAMPTZ,
  commission_received_amount   INTEGER,
  commission_notes             TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_org_id   ON brokerage_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_status   ON brokerage_requests(status);
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_listing  ON brokerage_requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_listings_brokerage_req      ON listings(brokerage_request_id)
  WHERE brokerage_request_id IS NOT NULL;

-- ── 5. Row-Level Security ────────────────────────────────────
ALTER TABLE brokerage_requests ENABLE ROW LEVEL SECURITY;

-- Org members (any role) can view their org's requests
CREATE POLICY "org_view_own_brokerage_requests"
  ON brokerage_requests FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Org owners / managers can submit new requests
CREATE POLICY "org_insert_brokerage_requests"
  ON brokerage_requests FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'branch_manager', 'agent')
    )
    AND agreed_broker_terms = true
    AND agreed_commission   = true
    AND submitted_by = auth.uid()
  );

-- Org owners/managers can cancel their own pending requests
CREATE POLICY "org_cancel_own_requests"
  ON brokerage_requests FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'branch_manager')
    )
    AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

-- Staff and admin have full access
CREATE POLICY "staff_admin_full_brokerage_access"
  ON brokerage_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'staff'))
  );

-- ── 6. Auto-update updated_at ────────────────────────────────
CREATE OR REPLACE FUNCTION update_brokerage_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_brokerage_requests_updated_at ON brokerage_requests;
CREATE TRIGGER trg_brokerage_requests_updated_at
  BEFORE UPDATE ON brokerage_requests
  FOR EACH ROW EXECUTE FUNCTION update_brokerage_requests_updated_at();

-- ── SETUP NOTES ──────────────────────────────────────────────
-- After running this migration:
--
-- 1. Create the NyumbaFasta Broker dalali account:
--    - Go to Supabase Auth → Add user  (email: broker@nyumbafasta.com)
--    - In users table, set role = 'dalali'
--    - In dalali_profiles, set:
--        is_platform_broker = true
--        whatsapp_number    = '+255XXXXXXXXX'  ← staff brokerage WhatsApp
--        broker_whatsapp    = '+255XXXXXXXXX'
--        is_verified        = true
--        subscription_plan  = 'premium'
--
-- 2. The broker account bypasses subscription listing limits (checked server-side
--    via is_platform_broker = true flag).
--
-- 3. When staff clicks "Post Listing", the API looks up this account automatically.
