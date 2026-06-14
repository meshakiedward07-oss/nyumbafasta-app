-- CRM Fix: Missing tables + RLS fixes
-- Run in Supabase SQL Editor
-- Date: 2026-06-14
-- Fixes:
--   1. commissions table (missing — CommissionClient breaks without it)
--   2. followup_schedules table (missing — daily cron step 11 + followup route break)
--   3. agent_leads RLS — dalali can now see their own assigned leads
--   4. lead_communications, lead_tasks, call_logs — RLS for dalali

-- ── 0. Helper function (create if not exists) ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── 1. commissions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID REFERENCES agent_leads(id) ON DELETE SET NULL,
  dalali_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  deal_value        BIGINT NOT NULL DEFAULT 0,
  commission_rate   NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  commission_amount BIGINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'paid')),
  notes             TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS commissions_updated_at ON commissions;
CREATE TRIGGER commissions_updated_at
  BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS commissions_lead_idx   ON commissions (lead_id);
CREATE INDEX IF NOT EXISTS commissions_dalali_idx ON commissions (dalali_id);
CREATE INDEX IF NOT EXISTS commissions_status_idx ON commissions (status);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_commissions" ON commissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "dalali_read_own_commissions" ON commissions
  FOR SELECT USING (dalali_id = auth.uid());

-- ── 2. followup_schedules ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS followup_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES agent_leads(id) ON DELETE CASCADE,
  followup_type   TEXT NOT NULL DEFAULT 'call'
                    CHECK (followup_type IN ('call', 'whatsapp', 'viewing', 'email', 'other')),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS followup_sched_lead_idx   ON followup_schedules (lead_id);
CREATE INDEX IF NOT EXISTS followup_sched_status_idx ON followup_schedules (status);
CREATE INDEX IF NOT EXISTS followup_sched_at_idx     ON followup_schedules (scheduled_at);

ALTER TABLE followup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_followups" ON followup_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 3. agent_leads — add dalali RLS policy ────────────────────────────────
-- Dalali can SELECT only their assigned leads
-- (existing admin policies remain)
DROP POLICY IF EXISTS "dalali_read_own_leads" ON agent_leads;
CREATE POLICY "dalali_read_own_leads" ON agent_leads
  FOR SELECT USING (assigned_to = auth.uid());

-- Dalali can UPDATE pipeline_stage + last_contacted_at on their own leads
DROP POLICY IF EXISTS "dalali_update_own_leads" ON agent_leads;
CREATE POLICY "dalali_update_own_leads" ON agent_leads
  FOR UPDATE USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- ── 4. lead_communications — RLS for dalali ───────────────────────────────
ALTER TABLE lead_communications ENABLE ROW LEVEL SECURITY;

-- Admins
DROP POLICY IF EXISTS "admin_all_lead_comms" ON lead_communications;
CREATE POLICY "admin_all_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Dalali: manage comms on their own leads
DROP POLICY IF EXISTS "dalali_own_lead_comms" ON lead_communications;
CREATE POLICY "dalali_own_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_communications.lead_id
        AND assigned_to = auth.uid()
    )
  );

-- ── 5. lead_tasks — RLS for dalali ───────────────────────────────────────
ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_lead_tasks" ON lead_tasks;
CREATE POLICY "admin_all_lead_tasks" ON lead_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "dalali_own_lead_tasks" ON lead_tasks;
CREATE POLICY "dalali_own_lead_tasks" ON lead_tasks
  FOR ALL USING (
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_tasks.lead_id
        AND assigned_to = auth.uid()
    )
  );

-- ── 6. call_logs — RLS for dalali ────────────────────────────────────────
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_call_logs" ON call_logs;
CREATE POLICY "admin_all_call_logs" ON call_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "dalali_own_call_logs" ON call_logs;
CREATE POLICY "dalali_own_call_logs" ON call_logs
  FOR ALL USING (
    dalali_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = call_logs.lead_id
        AND assigned_to = auth.uid()
    )
  );

-- ── 7. ai_recommendations — RLS ──────────────────────────────────────────
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_ai_recs" ON ai_recommendations;
CREATE POLICY "admin_all_ai_recs" ON ai_recommendations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "dalali_read_own_ai_recs" ON ai_recommendations;
CREATE POLICY "dalali_read_own_ai_recs" ON ai_recommendations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = ai_recommendations.lead_id
        AND assigned_to = auth.uid()
    )
  );
