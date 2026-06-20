-- Staff role + lead schema corrections
-- Run in Supabase SQL Editor
-- Date: 2026-06-20
--
-- Context: agent_leads are PROSPECTIVE DALALI (agents to onboard).
-- They must be assigned to internal STAFF (role='staff'), never to
-- existing dalali. This migration enforces that at the DB level.

-- ── 1. Add 'staff' to users.role (enum type, not CHECK constraint) ─────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';

-- ── 2. Staff columns on users ──────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS staff_title       TEXT,
  ADD COLUMN IF NOT EXISTS staff_active      BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_leads_capacity INTEGER DEFAULT 20;

-- ── 3. Link converted lead → new dalali user (when prospect registers) ─────
ALTER TABLE agent_leads
  ADD COLUMN IF NOT EXISTS converted_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ── 4. Table comment ───────────────────────────────────────────────────────
COMMENT ON TABLE agent_leads IS
  'Prospective DALALI (real estate agents) to onboard onto NyumbaFasta.
   NOT client leads. assigned_to must reference users.role = staff.
   Never assign to role = dalali.';

COMMENT ON COLUMN agent_leads.assigned_to IS
  'References users.id WHERE role = staff (internal onboarding team).
   Must never be set to a dalali profile.';

-- ── 5. Fix RLS — remove dalali access, add staff access ───────────────────

-- Remove old dalali-specific policies (dalali must not see agent_leads)
DROP POLICY IF EXISTS "dalali_read_own_leads"   ON agent_leads;
DROP POLICY IF EXISTS "dalali_update_own_leads" ON agent_leads;

-- Staff can SELECT only their assigned leads
DROP POLICY IF EXISTS "staff_read_own_leads" ON agent_leads;
CREATE POLICY "staff_read_own_leads" ON agent_leads
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Staff can UPDATE pipeline_stage + last_contacted_at on their assigned leads
DROP POLICY IF EXISTS "staff_update_own_leads" ON agent_leads;
CREATE POLICY "staff_update_own_leads" ON agent_leads
  FOR UPDATE USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- ── 6. Fix RLS on lead_communications ─────────────────────────────────────
DROP POLICY IF EXISTS "dalali_own_lead_comms" ON lead_communications;

DROP POLICY IF EXISTS "staff_own_lead_comms" ON lead_communications;
CREATE POLICY "staff_own_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_communications.lead_id
        AND assigned_to = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 7. Fix RLS on call_logs ───────────────────────────────────────────────
-- call_logs.dalali_id stores the ID of whoever logged the call (staff/admin).
-- Column name is legacy — functionally stores staff user ID.
DROP POLICY IF EXISTS "dalali_own_call_logs" ON call_logs;

DROP POLICY IF EXISTS "staff_own_call_logs" ON call_logs;
CREATE POLICY "staff_own_call_logs" ON call_logs
  FOR ALL USING (
    dalali_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = call_logs.lead_id
        AND assigned_to = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 8. Fix RLS on lead_tasks ──────────────────────────────────────────────
DROP POLICY IF EXISTS "dalali_own_lead_tasks" ON lead_tasks;

DROP POLICY IF EXISTS "staff_own_lead_tasks" ON lead_tasks;
CREATE POLICY "staff_own_lead_tasks" ON lead_tasks
  FOR ALL USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_tasks.lead_id
        AND assigned_to = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 9. Index for staff-assigned leads ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS agent_leads_assigned_to_idx ON agent_leads (assigned_to);
CREATE INDEX IF NOT EXISTS agent_leads_converted_to_idx ON agent_leads (converted_to_user_id);
