-- ═══════════════════════════════════════════════════════════════════════════════
-- advisor_fixes_2026_08_16.sql
-- Fix Supabase Advisor warnings:
--   1. auth_rls_initplan          (~55 warnings) — wrap auth.uid() in (SELECT …)
--   2. function_search_path_mutable (~16 warnings) — add SET search_path = public
-- Safe to re-run: DROP POLICY IF EXISTS + CREATE OR REPLACE FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: RLS POLICY FIXES (auth_rls_initplan)
-- Replace raw auth.uid() with (SELECT auth.uid()) so Postgres evaluates it
-- once per query (init plan) instead of once per row (re-evaluated).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── saved_listings ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "saved_listings_select" ON saved_listings;
CREATE POLICY "saved_listings_select" ON saved_listings
  FOR SELECT USING (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "saved_listings_insert" ON saved_listings;
CREATE POLICY "saved_listings_insert" ON saved_listings
  FOR INSERT WITH CHECK (client_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "saved_listings_delete" ON saved_listings;
CREATE POLICY "saved_listings_delete" ON saved_listings
  FOR DELETE USING (client_id = (SELECT auth.uid()));

-- ── profile_views ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pv_dalali_own" ON profile_views;
CREATE POLICY "pv_dalali_own" ON profile_views
  FOR SELECT USING (dalali_id = (SELECT auth.uid()));

-- ── profile_click_events ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pce_dalali_own" ON profile_click_events;
CREATE POLICY "pce_dalali_own" ON profile_click_events
  FOR SELECT USING (dalali_id = (SELECT auth.uid()));

-- ── dalali_income ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Own income only" ON dalali_income;
CREATE POLICY "Own income only" ON dalali_income
  FOR ALL
  USING     (dalali_id = (SELECT auth.uid()))
  WITH CHECK (dalali_id = (SELECT auth.uid()));

-- ── dalali_expenses ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Own expenses only" ON dalali_expenses;
CREATE POLICY "Own expenses only" ON dalali_expenses
  FOR ALL
  USING     (dalali_id = (SELECT auth.uid()))
  WITH CHECK (dalali_id = (SELECT auth.uid()));

-- ── dalali_commissions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Own commissions only" ON dalali_commissions;
CREATE POLICY "Own commissions only" ON dalali_commissions
  FOR ALL
  USING     (dalali_id = (SELECT auth.uid()))
  WITH CHECK (dalali_id = (SELECT auth.uid()));

-- ── dalali_goals ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Own goals only" ON dalali_goals;
CREATE POLICY "Own goals only" ON dalali_goals
  FOR ALL
  USING     (dalali_id = (SELECT auth.uid()))
  WITH CHECK (dalali_id = (SELECT auth.uid()));

-- ── boost_payments ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "boost_dalali_own" ON boost_payments;
CREATE POLICY "boost_dalali_own" ON boost_payments
  FOR SELECT USING (dalali_id = (SELECT auth.uid()));

-- ── dalali_account_warnings ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "daw_dalali_read_own" ON dalali_account_warnings;
CREATE POLICY "daw_dalali_read_own" ON dalali_account_warnings
  FOR SELECT USING (dalali_id = (SELECT auth.uid()));

-- ── recently_viewed ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rv_own_all" ON recently_viewed;
CREATE POLICY "rv_own_all" ON recently_viewed
  FOR ALL
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── tiktok_connections ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tiktok_conn_own" ON tiktok_connections;
CREATE POLICY "tiktok_conn_own" ON tiktok_connections
  FOR ALL
  USING     (dalali_id = (SELECT auth.uid()))
  WITH CHECK (dalali_id = (SELECT auth.uid()));

-- ── tiktok_posts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tiktok_posts_own" ON tiktok_posts;
CREATE POLICY "tiktok_posts_own" ON tiktok_posts
  FOR ALL
  USING     (dalali_id = (SELECT auth.uid()))
  WITH CHECK (dalali_id = (SELECT auth.uid()));

-- ── followup_schedules ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "followup_dalali_own" ON followup_schedules;
CREATE POLICY "followup_dalali_own" ON followup_schedules
  FOR ALL
  USING     (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

-- ── push_subscriptions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON push_subscriptions
  FOR ALL
  USING     (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── users ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_authenticated_read" ON users;
CREATE POLICY "users_authenticated_read" ON users
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- ── dalali_profiles ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dalali_profiles_authenticated_read" ON dalali_profiles;
CREATE POLICY "dalali_profiles_authenticated_read" ON dalali_profiles
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

-- ── admin_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_logs_service_role" ON admin_logs;
CREATE POLICY "admin_logs_service_role" ON admin_logs
  FOR ALL
  USING     ((SELECT auth.uid()) IS NULL)
  WITH CHECK ((SELECT auth.uid()) IS NULL);

-- ── sop_acknowledgements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "own ack insert" ON sop_acknowledgements;
CREATE POLICY "own ack insert" ON sop_acknowledgements
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "own ack update" ON sop_acknowledgements;
CREATE POLICY "own ack update" ON sop_acknowledgements
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "admin staff read" ON sop_acknowledgements;
CREATE POLICY "admin staff read" ON sop_acknowledgements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'staff')
  ));

-- ── dalali_invoices ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Dalali can manage own invoices" ON dalali_invoices;
CREATE POLICY "Dalali can manage own invoices" ON dalali_invoices
  FOR ALL USING (dalali_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admin can view all dalali invoices" ON dalali_invoices;
CREATE POLICY "Admin can view all dalali invoices" ON dalali_invoices
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')
  ));

-- ── dalali_invoice_items ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Dalali can manage own invoice items" ON dalali_invoice_items;
CREATE POLICY "Dalali can manage own invoice items" ON dalali_invoice_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM dalali_invoices
    WHERE id = dalali_invoice_items.invoice_id AND dalali_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Admin can view all invoice items" ON dalali_invoice_items;
CREATE POLICY "Admin can view all invoice items" ON dalali_invoice_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')
  ));

-- ── fundi_subscriptions ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fundi_subs_own" ON fundi_subscriptions;
CREATE POLICY "fundi_subs_own" ON fundi_subscriptions
  FOR SELECT USING (fundi_user_id = (SELECT auth.uid()));

-- ── fundi_subscription_plans ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "fundi_plans_admin_all" ON fundi_subscription_plans;
CREATE POLICY "fundi_plans_admin_all" ON fundi_subscription_plans
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = (SELECT auth.uid()) AND u.role IN ('admin', 'staff')
  ));

-- ── referrals ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dalali_read_own_referrals" ON referrals;
CREATE POLICY "dalali_read_own_referrals" ON referrals
  FOR SELECT USING (referrer_id = (SELECT auth.uid()));

-- ── dalali_report_downloads ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "dalali_own_report_downloads" ON dalali_report_downloads;
CREATE POLICY "dalali_own_report_downloads" ON dalali_report_downloads
  FOR ALL USING (dalali_id = (SELECT auth.uid()));

-- ── influencer_profiles ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Influencers read own profile" ON influencer_profiles;
CREATE POLICY "Influencers read own profile" ON influencer_profiles
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admin manages influencer profiles" ON influencer_profiles;
CREATE POLICY "Admin manages influencer profiles" ON influencer_profiles
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── referral_attributions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Influencers read own referrals" ON referral_attributions;
CREATE POLICY "Influencers read own referrals" ON referral_attributions
  FOR SELECT
  USING (influencer_id IN (
    SELECT id FROM influencer_profiles WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Admin manages referral attributions" ON referral_attributions;
CREATE POLICY "Admin manages referral attributions" ON referral_attributions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── influencer_payout_stages ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Influencers read own payout stages" ON influencer_payout_stages;
CREATE POLICY "Influencers read own payout stages" ON influencer_payout_stages
  FOR SELECT
  USING (influencer_id IN (
    SELECT id FROM influencer_profiles WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Admin manages payout stages" ON influencer_payout_stages;
CREATE POLICY "Admin manages payout stages" ON influencer_payout_stages
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── agreement_versions ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_agreement_versions" ON agreement_versions;
CREATE POLICY "admin_manage_agreement_versions" ON agreement_versions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── user_agreements ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_user_agreements" ON user_agreements;
CREATE POLICY "admin_all_user_agreements" ON user_agreements
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "user_read_own_agreement" ON user_agreements;
CREATE POLICY "user_read_own_agreement" ON user_agreements
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ── agreement_violations ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_violations" ON agreement_violations;
CREATE POLICY "admin_all_violations" ON agreement_violations
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "reporter_read_own_violations" ON agreement_violations;
CREATE POLICY "reporter_read_own_violations" ON agreement_violations
  FOR SELECT USING (reporter_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_insert_violation" ON agreement_violations;
CREATE POLICY "user_insert_violation" ON agreement_violations
  FOR INSERT WITH CHECK (reporter_id = (SELECT auth.uid()));

-- ── staff_activity_log ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_read_all_activity" ON staff_activity_log;
DROP POLICY IF EXISTS "admin_read_activity"     ON staff_activity_log;
CREATE POLICY "admin_read_activity" ON staff_activity_log
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "staff_read_own_activity" ON staff_activity_log;
CREATE POLICY "staff_read_own_activity" ON staff_activity_log
  FOR SELECT USING (staff_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "staff_insert_own_activity" ON staff_activity_log;
CREATE POLICY "staff_insert_own_activity" ON staff_activity_log
  FOR INSERT WITH CHECK (
    staff_id = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ── staff_permissions ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_staff_permissions" ON staff_permissions;
CREATE POLICY "admin_manage_staff_permissions" ON staff_permissions
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── staff_assignments ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_assignments_select" ON staff_assignments;
CREATE POLICY "staff_assignments_select" ON staff_assignments
  FOR SELECT USING (
    (SELECT auth.uid()) = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_assignments_admin_write" ON staff_assignments;
CREATE POLICY "staff_assignments_admin_write" ON staff_assignments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── staff_legal_info ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_legal_select" ON staff_legal_info;
CREATE POLICY "staff_legal_select" ON staff_legal_info
  FOR SELECT USING (
    (SELECT auth.uid()) = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_legal_write" ON staff_legal_info;
CREATE POLICY "staff_legal_write" ON staff_legal_info
  FOR ALL USING (
    (SELECT auth.uid()) = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ── staff_documents ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_docs_select" ON staff_documents;
CREATE POLICY "staff_docs_select" ON staff_documents
  FOR SELECT USING (
    (SELECT auth.uid()) = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_docs_admin_write" ON staff_documents;
CREATE POLICY "staff_docs_admin_write" ON staff_documents
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── staff_payroll ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_payroll_select" ON staff_payroll;
CREATE POLICY "staff_payroll_select" ON staff_payroll
  FOR SELECT USING (
    (SELECT auth.uid()) = staff_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_payroll_admin_write" ON staff_payroll;
CREATE POLICY "staff_payroll_admin_write" ON staff_payroll
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── agent_leads ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_read_own_leads" ON agent_leads;
CREATE POLICY "staff_read_own_leads" ON agent_leads
  FOR SELECT USING (
    assigned_to = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "staff_update_own_leads" ON agent_leads;
CREATE POLICY "staff_update_own_leads" ON agent_leads
  FOR UPDATE
  USING     (assigned_to = (SELECT auth.uid()))
  WITH CHECK (assigned_to = (SELECT auth.uid()));

DROP POLICY IF EXISTS "admin_manage_leads" ON agent_leads;
CREATE POLICY "admin_manage_leads" ON agent_leads
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── lead_communications ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_lead_comms" ON lead_communications;
CREATE POLICY "admin_all_lead_comms" ON lead_communications
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "staff_own_lead_comms" ON lead_communications;
CREATE POLICY "staff_own_lead_comms" ON lead_communications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_communications.lead_id AND assigned_to = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ── lead_tasks ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_lead_tasks" ON lead_tasks;
CREATE POLICY "admin_all_lead_tasks" ON lead_tasks
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "staff_own_lead_tasks" ON lead_tasks;
CREATE POLICY "staff_own_lead_tasks" ON lead_tasks
  FOR ALL USING (
    assigned_to = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = lead_tasks.lead_id AND assigned_to = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ── call_logs ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_all_call_logs" ON call_logs;
CREATE POLICY "admin_all_call_logs" ON call_logs
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

DROP POLICY IF EXISTS "staff_own_call_logs" ON call_logs;
CREATE POLICY "staff_own_call_logs" ON call_logs
  FOR ALL USING (
    dalali_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM agent_leads
      WHERE id = call_logs.lead_id AND assigned_to = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ── lead_activity_log ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin/staff read activity" ON lead_activity_log;
CREATE POLICY "Admin/staff read activity" ON lead_activity_log
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')
  ));

DROP POLICY IF EXISTS "Admin/staff insert activity" ON lead_activity_log;
CREATE POLICY "Admin/staff insert activity" ON lead_activity_log
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')
  ));

-- ── listing_occupancy_log ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dalali_read_own_occupancy_log" ON listing_occupancy_log;
CREATE POLICY "dalali_read_own_occupancy_log" ON listing_occupancy_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE id = listing_occupancy_log.listing_id
        AND dalali_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ── commission_rules ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "commission_rules_read" ON commission_rules;
CREATE POLICY "commission_rules_read" ON commission_rules
  FOR SELECT TO authenticated
  USING (
    active = true
    OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "commission_rules_admin" ON commission_rules;
CREATE POLICY "commission_rules_admin" ON commission_rules
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ── brokerage_commissions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "brokerage_commissions_admin" ON brokerage_commissions;
CREATE POLICY "brokerage_commissions_admin" ON brokerage_commissions
  FOR ALL TO authenticated
  USING     (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));

-- ── staff_workload ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_workload_access" ON staff_workload;
CREATE POLICY "staff_workload_access" ON staff_workload
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')
  ));

-- ── conflict_flags ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conflict_flags_access" ON conflict_flags;
CREATE POLICY "conflict_flags_access" ON conflict_flags
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')
  ));

-- ── video_uploads ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_all_video_uploads" ON video_uploads;
CREATE POLICY "admins_all_video_uploads" ON video_uploads
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── app_settings ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin write" ON app_settings;
CREATE POLICY "admin write" ON app_settings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'
  ));

-- ── ad_creatives ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ad_creatives_advertiser_all" ON ad_creatives;
CREATE POLICY "ad_creatives_advertiser_all" ON ad_creatives
  FOR ALL
  USING (advertiser_id IN (
    SELECT id FROM advertisers WHERE user_id = (SELECT auth.uid())
  ));

-- ── brokerage_requests ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_view_own_brokerage_requests" ON brokerage_requests;
CREATE POLICY "org_view_own_brokerage_requests" ON brokerage_requests
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "org_insert_brokerage_requests" ON brokerage_requests;
CREATE POLICY "org_insert_brokerage_requests" ON brokerage_requests
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'branch_manager', 'agent')
    )
    AND agreed_broker_terms = true
    AND agreed_commission   = true
    AND submitted_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "org_cancel_own_requests" ON brokerage_requests;
CREATE POLICY "org_cancel_own_requests" ON brokerage_requests
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'branch_manager')
    )
    AND status = 'pending'
  )
  WITH CHECK (status = 'cancelled');

DROP POLICY IF EXISTS "staff_admin_full_brokerage_access" ON brokerage_requests;
CREATE POLICY "staff_admin_full_brokerage_access" ON brokerage_requests
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'staff')
  ));

-- ── org_income_entries ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Org members read own entries" ON org_income_entries;
CREATE POLICY "Org members read own entries" ON org_income_entries
  FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Tenants read entries they submitted" ON org_income_entries;
CREATE POLICY "Tenants read entries they submitted" ON org_income_entries
  FOR SELECT USING (submitted_by = (SELECT auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: FUNCTION FIXES (function_search_path_mutable)
-- Add SET search_path = public to every affected function.
-- Body is unchanged — only the function header gains the SET clause.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── nf_rate_limit_check ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nf_rate_limit_check(
  p_identifier TEXT,
  p_platform   TEXT,
  p_window_sec INT  DEFAULT 60,
  p_max_count  INT  DEFAULT 15
)
RETURNS TABLE (allowed BOOLEAN, current_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  BIGINT;
  v_cutoff TIMESTAMPTZ;
BEGIN
  v_cutoff := NOW() - (p_window_sec || ' seconds')::INTERVAL;

  SELECT COUNT(*) INTO v_count
  FROM cascade_rate_limits
  WHERE identifier = p_identifier
    AND platform   = p_platform
    AND created_at  > v_cutoff;

  IF v_count < p_max_count THEN
    INSERT INTO cascade_rate_limits(identifier, platform) VALUES(p_identifier, p_platform);
    RETURN QUERY SELECT TRUE, v_count + 1;
  ELSE
    RETURN QUERY SELECT FALSE, v_count;
  END IF;
END;
$$;

-- ── nf_rate_limit_cleanup ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nf_rate_limit_cleanup(p_older_than_sec INT DEFAULT 120)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM cascade_rate_limits
  WHERE created_at < NOW() - (p_older_than_sec || ' seconds')::INTERVAL;
END;
$$;

-- ── nf_kb_candidates (latest version: audience='external' filter from sop_kpi) ─
CREATE OR REPLACE FUNCTION nf_kb_candidates(
  p_query TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (id UUID, slug TEXT, title TEXT, body TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT kb.id, kb.slug, kb.title, kb.body
    FROM knowledge_base kb
    WHERE kb.is_active = true
      AND kb.audience = 'external'
      AND kb.fts_vector @@ plainto_tsquery('simple', p_query)
    ORDER BY ts_rank(kb.fts_vector, plainto_tsquery('simple', p_query)) DESC
    LIMIT p_limit;
END;
$$;

-- ── nf_cache_lookup ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nf_cache_lookup(
  p_question  TEXT,
  p_threshold FLOAT DEFAULT 0.40,
  p_limit     INT   DEFAULT 1
)
RETURNS TABLE (id UUID, answer TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kc.id,
      kc.answer,
      similarity(kc.question, p_question) AS similarity
    FROM knowledge_cache kc
    WHERE kc.is_active = true
      AND similarity(kc.question, p_question) >= p_threshold
    ORDER BY similarity DESC
    LIMIT p_limit;
END;
$$;

-- ── nf_increment_cache_hit ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nf_increment_cache_hit(p_cache_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE knowledge_cache
     SET hit_count   = hit_count + 1,
         last_hit_at = NOW()
   WHERE id = p_cache_id;
END;
$$;

-- ── touch_updated_at (generic trigger helper) ─────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── update_brokerage_requests_updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_brokerage_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── update_video_uploads_updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_video_uploads_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── nf_touch_chat_session ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nf_touch_chat_session()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── set_updated_at_fundi_plans ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_fundi_plans()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── set_updated_at_fundi_subs ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at_fundi_subs()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── update_dalali_last_listing ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_dalali_last_listing()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE users SET
    last_listing_at               = NOW(),
    account_deletion_scheduled_at = NULL,
    listing_warnings_count        = 0,
    listing_warning_sent_at       = NULL
  WHERE id = NEW.dalali_id;
  RETURN NEW;
END;
$$;

-- ── check_listing_capacity ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_listing_capacity()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.current_occupancy >= NEW.total_capacity
     AND NEW.auto_deactivate_on_full = true
     AND NEW.status = 'active' THEN
    NEW.status := 'taken';
    NEW.auto_deactivated_at := NOW();
  END IF;
  NEW.occupancy_last_updated := NOW();
  RETURN NEW;
END;
$$;

-- ── generate_location_display ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_location_display()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.location_display :=
    CONCAT_WS(', ',
      NULLIF(TRIM(NEW.mtaa),     ''),
      NULLIF(TRIM(NEW.ward),     ''),
      NULLIF(TRIM(NEW.district), '')
    )
    || CASE
         WHEN NEW.region IS NOT NULL AND TRIM(NEW.region) <> ''
         THEN ' — ' || TRIM(NEW.region)
         ELSE ''
       END;
  RETURN NEW;
END;
$$;

-- ── upsert_spam_account ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_spam_account(
  p_platform     TEXT,
  p_account_id   TEXT,
  p_account_name TEXT
)
RETURNS void LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO spam_accounts (platform, account_id, account_name, spam_count, last_spam_at)
  VALUES (p_platform, p_account_id, p_account_name, 1, NOW())
  ON CONFLICT (platform, account_id) DO UPDATE SET
    spam_count   = spam_accounts.spam_count + 1,
    account_name = EXCLUDED.account_name,
    last_spam_at = NOW(),
    is_blocked   = CASE
      WHEN spam_accounts.spam_count + 1 >= 5 THEN true
      ELSE spam_accounts.is_blocked
    END;
END;
$$;

-- ── get_monthly_expenses ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_monthly_expenses(target_month TEXT)
RETURNS TABLE (
  id            UUID,
  category      TEXT,
  description   TEXT,
  amount_tzs    NUMERIC,
  is_recurring  BOOLEAN,
  billing_month TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    er.id, er.category, er.description, er.amount_tzs, er.is_recurring, er.billing_month
  FROM expense_records er
  WHERE er.billing_month = target_month

  UNION ALL

  SELECT
    gen_random_uuid(), re.category, re.description, re.amount_tzs, true, target_month
  FROM recurring_expenses re
  WHERE re.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM expense_records er2
      WHERE er2.billing_month = target_month
        AND er2.description   = re.description
        AND er2.is_recurring  = true
    );
END;
$$;
