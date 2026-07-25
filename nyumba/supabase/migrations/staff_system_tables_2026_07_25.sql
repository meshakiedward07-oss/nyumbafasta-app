-- Staff system tables migration
-- Run this in Supabase SQL Editor
-- Required by: staff assignments, legal info, documents, payroll APIs

-- ─── staff_assignments ────────────────────────────────────────────────────────
-- Tracks tasks/listings/leads assigned to staff members by admin

CREATE TABLE IF NOT EXISTS staff_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by  UUID        NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  type         TEXT        NOT NULL CHECK (type IN ('listing', 'lead', 'report', 'user', 'other')),
  ref_id       UUID,                        -- ID of the related entity (listing_id, lead_id, etc.)
  title        TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority     TEXT        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at       TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_staff_id   ON staff_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_sa_status     ON staff_assignments(status);
CREATE INDEX IF NOT EXISTS idx_sa_assigned_by ON staff_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_sa_created_at ON staff_assignments(created_at DESC);

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;

-- Admin and owner staff can see assignments
CREATE POLICY "staff_assignments_select" ON staff_assignments
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admin can insert/update/delete
CREATE POLICY "staff_assignments_admin_write" ON staff_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── staff_legal_info ────────────────────────────────────────────────────────
-- Stores employment contract and legal information per staff member

CREATE TABLE IF NOT EXISTS staff_legal_info (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  nida_number      TEXT,
  contract_type    TEXT        CHECK (contract_type IN ('full_time', 'part_time', 'contract', 'internship')),
  contract_start   DATE,
  contract_end     DATE,
  salary_basis     TEXT        CHECK (salary_basis IN ('monthly', 'weekly', 'daily', 'per_task')),
  agreed_salary    NUMERIC(12, 2),
  notice_period    INT         DEFAULT 30,        -- days
  confidentiality  BOOLEAN     DEFAULT FALSE,     -- signed NDA
  non_compete      BOOLEAN     DEFAULT FALSE,     -- signed non-compete
  emergency_name   TEXT,
  emergency_phone  TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sli_staff_id ON staff_legal_info(staff_id);

ALTER TABLE staff_legal_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_legal_info_select" ON staff_legal_info
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "staff_legal_info_admin_write" ON staff_legal_info
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── staff_documents ─────────────────────────────────────────────────────────
-- Uploaded files: contracts, IDs, certifications, etc.

CREATE TABLE IF NOT EXISTS staff_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  uploaded_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  doc_type     TEXT        NOT NULL CHECK (doc_type IN ('contract', 'nida', 'certificate', 'payslip', 'other')),
  label        TEXT        NOT NULL,
  file_url     TEXT        NOT NULL,
  file_size    INT,            -- bytes
  mime_type    TEXT,
  is_private   BOOLEAN     NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_staff_id   ON staff_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_sd_doc_type   ON staff_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_sd_created_at ON staff_documents(created_at DESC);

ALTER TABLE staff_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_documents_select" ON staff_documents
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "staff_documents_admin_write" ON staff_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── staff_payroll ────────────────────────────────────────────────────────────
-- Monthly payroll records per staff member

CREATE TABLE IF NOT EXISTS staff_payroll (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  processed_by   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  period_month   INT         NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year    INT         NOT NULL,
  base_salary    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  bonus          NUMERIC(12, 2)          DEFAULT 0,
  deductions     NUMERIC(12, 2)          DEFAULT 0,
  net_pay        NUMERIC(12, 2) GENERATED ALWAYS AS (base_salary + COALESCE(bonus,0) - COALESCE(deductions,0)) STORED,
  currency       TEXT        NOT NULL DEFAULT 'TZS',
  payment_method TEXT        CHECK (payment_method IN ('bank', 'mobile_money', 'cash', 'other')),
  payment_ref    TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at        TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_sp_staff_id    ON staff_payroll(staff_id);
CREATE INDEX IF NOT EXISTS idx_sp_period      ON staff_payroll(period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_sp_status      ON staff_payroll(status);

ALTER TABLE staff_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_payroll_select" ON staff_payroll
  FOR SELECT USING (
    auth.uid() = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "staff_payroll_admin_write" ON staff_payroll
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
