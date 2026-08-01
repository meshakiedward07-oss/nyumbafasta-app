-- Property management gaps migration — 2026-08-01
-- Run this manually in the Supabase SQL editor.

-- 1. Reminder settings columns on organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS remind_days_before        INT     DEFAULT 3;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS remind_days_overdue       INT     DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_whatsapp_reminders BOOLEAN DEFAULT TRUE;

-- 2. Org-level recurring expense templates
CREATE TABLE IF NOT EXISTS org_recurring_expenses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_tzs       BIGINT      NOT NULL CHECK (amount_tzs > 0),
  category         TEXT        NOT NULL DEFAULT 'other',
  description      TEXT        NOT NULL,
  vendor           TEXT,
  payment_method   TEXT        NOT NULL DEFAULT 'cash',
  day_of_month     INT         NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  last_applied_month TEXT,                    -- 'YYYY-MM' — tracks last auto-creation
  created_by       UUID        REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE org_recurring_expenses ENABLE ROW LEVEL SECURITY;

-- Members of the org can manage their recurring expense templates
CREATE POLICY "org_members_recurring_expenses" ON org_recurring_expenses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = org_recurring_expenses.organization_id
        AND user_id = auth.uid()
    )
  );
