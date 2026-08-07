-- org_fixes_2026_08_07.sql
-- Fixes three broken org features:
--   1. Internal messaging (conversations.source_role + updated RPC)
--   2. Mali / property saving (listings columns: listing_source, lifecycle_status, managing_org_id)
--   3. Matumizi / expenses (org_expenses + org_recurring_expenses tables)
--
-- Safe to re-run: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout
-- Paste full file into Supabase SQL Editor and click Run

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. INTERNAL MESSAGING — add source_role + update nf_get_conversations RPC
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source_role TEXT;

-- Backfill existing dalali conversations
UPDATE conversations c
SET source_role = 'dalali'
FROM users u
WHERE c.created_by = u.id
  AND u.role = 'dalali'
  AND c.source_role IS NULL;

-- Replace nf_get_conversations with 5-param version (p_source_role)
CREATE OR REPLACE FUNCTION nf_get_conversations(
  p_user_id     uuid,
  p_org_id      uuid    DEFAULT NULL,
  p_type        text    DEFAULT NULL,
  p_limit       integer DEFAULT 50,
  p_source_role text    DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  title           text,
  conv_type       text,
  status          text,
  context_type    text,
  context_id      uuid,
  org_id          uuid,
  created_by      uuid,
  source_role     text,
  last_message_at timestamptz,
  created_at      timestamptz,
  last_message    jsonb,
  unread_count    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  user_convs AS (
    SELECT cp.conversation_id, cp.last_read_at
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      jsonb_build_object(
        'id',           m.id,
        'body',         m.body,
        'sender_id',    m.sender_id,
        'created_at',   m.created_at,
        'message_type', m.message_type,
        'is_internal',  m.is_internal
      ) AS msg_json
    FROM messages m
    JOIN user_convs uc ON m.conversation_id = uc.conversation_id
    WHERE m.deleted_at IS NULL
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.conversation_id, COUNT(*) AS cnt
    FROM messages m
    JOIN user_convs uc ON m.conversation_id = uc.conversation_id
    WHERE m.deleted_at IS NULL
      AND m.created_at > COALESCE(uc.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY m.conversation_id
  )
  SELECT
    c.id,
    c.title,
    c.conv_type,
    c.status,
    c.context_type,
    c.context_id,
    c.org_id,
    c.created_by,
    c.source_role,
    c.last_message_at,
    c.created_at,
    lm.msg_json         AS last_message,
    COALESCE(u.cnt, 0)  AS unread_count
  FROM conversations c
  JOIN user_convs uc ON c.id = uc.conversation_id
  LEFT JOIN last_msgs  lm ON c.id = lm.conversation_id
  LEFT JOIN unread     u  ON c.id = u.conversation_id
  WHERE (p_org_id      IS NULL OR c.org_id      = p_org_id)
    AND (p_type        IS NULL OR c.conv_type   = p_type)
    AND (p_source_role IS NULL OR c.source_role = p_source_role)
  ORDER BY c.last_message_at DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_get_conversations(uuid, uuid, text, integer, text) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. MALI / PROPERTIES — add missing columns to listings
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS listing_source  TEXT NOT NULL DEFAULT 'dalali'
    CHECK (listing_source IN ('dalali', 'nyumbafasta_managed'));

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'listed'
    CHECK (lifecycle_status IN ('draft','listed','under_offer','leased_managed','ended','relisted'));

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS managing_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_source       ON listings(listing_source);
CREATE INDEX IF NOT EXISTS idx_listings_lifecycle    ON listings(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_listings_managing_org ON listings(managing_org_id);

-- Backfill lifecycle_status for existing listings
UPDATE listings SET lifecycle_status = 'leased_managed' WHERE status = 'taken'   AND lifecycle_status = 'listed';
UPDATE listings SET lifecycle_status = 'ended'           WHERE status = 'expired' AND lifecycle_status = 'listed';

-- Property units table (required by mali/route.ts GET)
CREATE TABLE IF NOT EXISTS property_units (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_number TEXT        NOT NULL,
  floor       INT,
  bedrooms    INT,
  bathrooms   NUMERIC(3,1),
  size_sqm    NUMERIC(8,2),
  status      TEXT        NOT NULL DEFAULT 'vacant'
                          CHECK (status IN ('vacant','occupied','maintenance','reserved')),
  rent_amount NUMERIC(12,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_property_units_listing ON property_units(listing_id);
CREATE INDEX IF NOT EXISTS idx_property_units_org     ON property_units(org_id);

ALTER TABLE property_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage property units" ON property_units;
CREATE POLICY "Org members can manage property units"
  ON property_units FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3a. MATUMIZI / EXPENSES — org_expenses table
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_expenses (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_tzs      NUMERIC(12,2) NOT NULL,
  category        TEXT         NOT NULL DEFAULT 'other'
    CHECK (category IN ('maintenance','utilities','salaries','marketing','legal','insurance','taxes','office','other')),
  description     TEXT         NOT NULL,
  vendor          TEXT,
  receipt_url     TEXT,
  expense_date    DATE         NOT NULL,
  payment_method  TEXT         DEFAULT 'cash'
    CHECK (payment_method IN ('cash','mpesa','airtel','bank_transfer','cheque','other')),
  notes           TEXT,
  recorded_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_expenses_org_id ON org_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_expenses_date   ON org_expenses(expense_date);

ALTER TABLE org_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage org expenses" ON org_expenses;
CREATE POLICY "Org members can manage org expenses"
  ON org_expenses FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3b. MATUMIZI / EXPENSES — org_recurring_expenses table (was missing entirely)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS org_recurring_expenses (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_tzs         NUMERIC(12,2) NOT NULL,
  category           TEXT         NOT NULL DEFAULT 'other'
    CHECK (category IN ('maintenance','utilities','salaries','marketing','legal','insurance','taxes','office','other')),
  description        TEXT         NOT NULL,
  vendor             TEXT,
  payment_method     TEXT         DEFAULT 'cash'
    CHECK (payment_method IN ('cash','mpesa','airtel','bank_transfer','cheque','other')),
  day_of_month       INT          NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
  last_applied_month TEXT,
  created_by         UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_recurring_expenses_org    ON org_recurring_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_recurring_expenses_active ON org_recurring_expenses(is_active) WHERE is_active = TRUE;

ALTER TABLE org_recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage recurring expenses" ON org_recurring_expenses;
CREATE POLICY "Org members can manage recurring expenses"
  ON org_recurring_expenses FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff'))
  );
