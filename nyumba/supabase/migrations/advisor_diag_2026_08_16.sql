-- ═══════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC SCRIPT — advisor_diag_2026_08_16.sql
-- Kila policy imefungwa katika DO block — script itaendelea hata kuna error.
-- Angalia NOTICE messages baada ya kurun — zitakuonyesha ni policy gani inashindwa.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  DROP POLICY IF EXISTS "saved_listings_select" ON saved_listings;
  CREATE POLICY "saved_listings_select" ON saved_listings
    FOR SELECT USING (client_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "saved_listings_insert" ON saved_listings;
  CREATE POLICY "saved_listings_insert" ON saved_listings
    FOR INSERT WITH CHECK (client_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "saved_listings_delete" ON saved_listings;
  CREATE POLICY "saved_listings_delete" ON saved_listings
    FOR DELETE USING (client_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [saved_listings]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pv_dalali_own" ON profile_views;
  CREATE POLICY "pv_dalali_own" ON profile_views
    FOR SELECT USING (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [profile_views]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "pce_dalali_own" ON profile_click_events;
  CREATE POLICY "pce_dalali_own" ON profile_click_events
    FOR SELECT USING (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [profile_click_events]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own income only" ON dalali_income;
  CREATE POLICY "Own income only" ON dalali_income
    FOR ALL USING (dalali_id = (SELECT auth.uid())) WITH CHECK (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_income]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own expenses only" ON dalali_expenses;
  CREATE POLICY "Own expenses only" ON dalali_expenses
    FOR ALL USING (dalali_id = (SELECT auth.uid())) WITH CHECK (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_expenses]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own commissions only" ON dalali_commissions;
  CREATE POLICY "Own commissions only" ON dalali_commissions
    FOR ALL USING (dalali_id = (SELECT auth.uid())) WITH CHECK (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_commissions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Own goals only" ON dalali_goals;
  CREATE POLICY "Own goals only" ON dalali_goals
    FOR ALL USING (dalali_id = (SELECT auth.uid())) WITH CHECK (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_goals]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "boost_dalali_own" ON boost_payments;
  CREATE POLICY "boost_dalali_own" ON boost_payments
    FOR SELECT USING (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [boost_payments]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "daw_dalali_read_own" ON dalali_account_warnings;
  CREATE POLICY "daw_dalali_read_own" ON dalali_account_warnings
    FOR SELECT USING (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_account_warnings]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "rv_own_all" ON recently_viewed;
  CREATE POLICY "rv_own_all" ON recently_viewed
    FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [recently_viewed]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tiktok_conn_own" ON tiktok_connections;
  DROP POLICY IF EXISTS "admin_tiktok_connections" ON tiktok_connections;
  CREATE POLICY "admin_tiktok_connections" ON tiktok_connections
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [tiktok_connections]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tiktok_posts_own" ON tiktok_posts;
  DROP POLICY IF EXISTS "admin_tiktok_posts" ON tiktok_posts;
  CREATE POLICY "admin_tiktok_posts" ON tiktok_posts
    FOR ALL USING (public.is_admin());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [tiktok_posts]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "followup_dalali_own" ON followup_schedules;
  CREATE POLICY "followup_dalali_own" ON followup_schedules
    FOR ALL USING (created_by = (SELECT auth.uid())) WITH CHECK (created_by = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [followup_schedules]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users manage own push subscriptions" ON push_subscriptions;
  CREATE POLICY "Users manage own push subscriptions" ON push_subscriptions
    FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [push_subscriptions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "users_authenticated_read" ON users;
  CREATE POLICY "users_authenticated_read" ON users
    FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [users]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "dalali_profiles_authenticated_read" ON dalali_profiles;
  CREATE POLICY "dalali_profiles_authenticated_read" ON dalali_profiles
    FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_profiles]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_logs_service_role" ON admin_logs;
  CREATE POLICY "admin_logs_service_role" ON admin_logs
    FOR ALL USING ((SELECT auth.uid()) IS NULL) WITH CHECK ((SELECT auth.uid()) IS NULL);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [admin_logs]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "own ack insert" ON sop_acknowledgements;
  CREATE POLICY "own ack insert" ON sop_acknowledgements
    FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "own ack update" ON sop_acknowledgements;
  CREATE POLICY "own ack update" ON sop_acknowledgements
    FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "admin staff read" ON sop_acknowledgements;
  CREATE POLICY "admin staff read" ON sop_acknowledgements
    FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = (SELECT auth.uid()) AND users.role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [sop_acknowledgements]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dalali can manage own invoices" ON dalali_invoices;
  CREATE POLICY "Dalali can manage own invoices" ON dalali_invoices
    FOR ALL USING (dalali_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "Admin can view all dalali invoices" ON dalali_invoices;
  CREATE POLICY "Admin can view all dalali invoices" ON dalali_invoices
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_invoices]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Dalali can manage own invoice items" ON dalali_invoice_items;
  CREATE POLICY "Dalali can manage own invoice items" ON dalali_invoice_items
    FOR ALL USING (EXISTS (
      SELECT 1 FROM dalali_invoices WHERE id = dalali_invoice_items.invoice_id AND dalali_id = (SELECT auth.uid())
    ));
  DROP POLICY IF EXISTS "Admin can view all invoice items" ON dalali_invoice_items;
  CREATE POLICY "Admin can view all invoice items" ON dalali_invoice_items
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_invoice_items]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fundi_subs_own" ON fundi_subscriptions;
  CREATE POLICY "fundi_subs_own" ON fundi_subscriptions
    FOR SELECT USING (fundi_user_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [fundi_subscriptions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "fundi_plans_admin_all" ON fundi_subscription_plans;
  CREATE POLICY "fundi_plans_admin_all" ON fundi_subscription_plans
    FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = (SELECT auth.uid()) AND u.role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [fundi_subscription_plans]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "dalali_read_own_referrals" ON referrals;
  CREATE POLICY "dalali_read_own_referrals" ON referrals
    FOR SELECT USING (referrer_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [referrals]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "dalali_own_report_downloads" ON dalali_report_downloads;
  CREATE POLICY "dalali_own_report_downloads" ON dalali_report_downloads
    FOR ALL USING (dalali_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [dalali_report_downloads]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Influencers read own profile" ON influencer_profiles;
  CREATE POLICY "Influencers read own profile" ON influencer_profiles
    FOR SELECT USING (user_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "Admin manages influencer profiles" ON influencer_profiles;
  CREATE POLICY "Admin manages influencer profiles" ON influencer_profiles
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [influencer_profiles]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Influencers read own referrals" ON referral_attributions;
  CREATE POLICY "Influencers read own referrals" ON referral_attributions
    FOR SELECT USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = (SELECT auth.uid())));
  DROP POLICY IF EXISTS "Admin manages referral attributions" ON referral_attributions;
  CREATE POLICY "Admin manages referral attributions" ON referral_attributions
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [referral_attributions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Influencers read own payout stages" ON influencer_payout_stages;
  CREATE POLICY "Influencers read own payout stages" ON influencer_payout_stages
    FOR SELECT USING (influencer_id IN (SELECT id FROM influencer_profiles WHERE user_id = (SELECT auth.uid())));
  DROP POLICY IF EXISTS "Admin manages payout stages" ON influencer_payout_stages;
  CREATE POLICY "Admin manages payout stages" ON influencer_payout_stages
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [influencer_payout_stages]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_manage_agreement_versions" ON agreement_versions;
  CREATE POLICY "admin_manage_agreement_versions" ON agreement_versions
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [agreement_versions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_all_user_agreements" ON user_agreements;
  CREATE POLICY "admin_all_user_agreements" ON user_agreements
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
  DROP POLICY IF EXISTS "user_read_own_agreement" ON user_agreements;
  CREATE POLICY "user_read_own_agreement" ON user_agreements
    FOR SELECT USING (user_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [user_agreements]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_all_violations" ON agreement_violations;
  CREATE POLICY "admin_all_violations" ON agreement_violations
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
  DROP POLICY IF EXISTS "reporter_read_own_violations" ON agreement_violations;
  CREATE POLICY "reporter_read_own_violations" ON agreement_violations
    FOR SELECT USING (reporter_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "user_insert_violation" ON agreement_violations;
  CREATE POLICY "user_insert_violation" ON agreement_violations
    FOR INSERT WITH CHECK (reporter_id = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [agreement_violations]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_read_all_activity" ON staff_activity_log;
  DROP POLICY IF EXISTS "admin_read_activity" ON staff_activity_log;
  CREATE POLICY "admin_read_activity" ON staff_activity_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
  DROP POLICY IF EXISTS "staff_read_own_activity" ON staff_activity_log;
  CREATE POLICY "staff_read_own_activity" ON staff_activity_log
    FOR SELECT USING (staff_id = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "staff_insert_own_activity" ON staff_activity_log;
  CREATE POLICY "staff_insert_own_activity" ON staff_activity_log
    FOR INSERT WITH CHECK (
      staff_id = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_activity_log]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_manage_staff_permissions" ON staff_permissions;
  CREATE POLICY "admin_manage_staff_permissions" ON staff_permissions
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_permissions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "staff_assignments_select" ON staff_assignments;
  CREATE POLICY "staff_assignments_select" ON staff_assignments
    FOR SELECT USING (
      (SELECT auth.uid()) = staff_id
      OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
  DROP POLICY IF EXISTS "staff_assignments_admin_write" ON staff_assignments;
  CREATE POLICY "staff_assignments_admin_write" ON staff_assignments
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_assignments]: %', SQLERRM;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_legal_info]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "staff_docs_select" ON staff_documents;
  CREATE POLICY "staff_docs_select" ON staff_documents
    FOR SELECT USING (
      (SELECT auth.uid()) = staff_id
      OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
  DROP POLICY IF EXISTS "staff_docs_admin_write" ON staff_documents;
  CREATE POLICY "staff_docs_admin_write" ON staff_documents
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_documents]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "staff_payroll_select" ON staff_payroll;
  CREATE POLICY "staff_payroll_select" ON staff_payroll
    FOR SELECT USING (
      (SELECT auth.uid()) = staff_id
      OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
  DROP POLICY IF EXISTS "staff_payroll_admin_write" ON staff_payroll;
  CREATE POLICY "staff_payroll_admin_write" ON staff_payroll
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_payroll]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "staff_read_own_leads" ON agent_leads;
  CREATE POLICY "staff_read_own_leads" ON agent_leads
    FOR SELECT USING (
      assigned_to = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
  DROP POLICY IF EXISTS "staff_update_own_leads" ON agent_leads;
  CREATE POLICY "staff_update_own_leads" ON agent_leads
    FOR UPDATE USING (assigned_to = (SELECT auth.uid())) WITH CHECK (assigned_to = (SELECT auth.uid()));
  DROP POLICY IF EXISTS "admin_manage_leads" ON agent_leads;
  CREATE POLICY "admin_manage_leads" ON agent_leads
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [agent_leads]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_all_lead_comms" ON lead_communications;
  CREATE POLICY "admin_all_lead_comms" ON lead_communications
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
  DROP POLICY IF EXISTS "staff_own_lead_comms" ON lead_communications;
  CREATE POLICY "staff_own_lead_comms" ON lead_communications
    FOR ALL USING (
      EXISTS (SELECT 1 FROM agent_leads WHERE id = lead_communications.lead_id AND assigned_to = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [lead_communications]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_all_lead_tasks" ON lead_tasks;
  CREATE POLICY "admin_all_lead_tasks" ON lead_tasks
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
  DROP POLICY IF EXISTS "staff_own_lead_tasks" ON lead_tasks;
  CREATE POLICY "staff_own_lead_tasks" ON lead_tasks
    FOR ALL USING (
      assigned_to = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM agent_leads WHERE id = lead_tasks.lead_id AND assigned_to = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [lead_tasks]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_all_call_logs" ON call_logs;
  CREATE POLICY "admin_all_call_logs" ON call_logs
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
  DROP POLICY IF EXISTS "staff_own_call_logs" ON call_logs;
  CREATE POLICY "staff_own_call_logs" ON call_logs
    FOR ALL USING (
      dalali_id = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM agent_leads WHERE id = call_logs.lead_id AND assigned_to = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [call_logs]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin/staff read activity" ON lead_activity_log;
  CREATE POLICY "Admin/staff read activity" ON lead_activity_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
  DROP POLICY IF EXISTS "Admin/staff insert activity" ON lead_activity_log;
  CREATE POLICY "Admin/staff insert activity" ON lead_activity_log
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [lead_activity_log]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "dalali_read_own_occupancy_log" ON listing_occupancy_log;
  CREATE POLICY "dalali_read_own_occupancy_log" ON listing_occupancy_log
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM listings WHERE id = listing_occupancy_log.listing_id AND dalali_id = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [listing_occupancy_log]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "commission_rules_read" ON commission_rules;
  CREATE POLICY "commission_rules_read" ON commission_rules
    FOR SELECT TO authenticated USING (
      active = true OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    );
  DROP POLICY IF EXISTS "commission_rules_admin" ON commission_rules;
  CREATE POLICY "commission_rules_admin" ON commission_rules
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [commission_rules]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "brokerage_commissions_admin" ON brokerage_commissions;
  CREATE POLICY "brokerage_commissions_admin" ON brokerage_commissions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [brokerage_commissions]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "staff_workload_access" ON staff_workload;
  CREATE POLICY "staff_workload_access" ON staff_workload
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [staff_workload]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "conflict_flags_access" ON conflict_flags;
  CREATE POLICY "conflict_flags_access" ON conflict_flags
    FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [conflict_flags]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admins_all_video_uploads" ON video_uploads;
  CREATE POLICY "admins_all_video_uploads" ON video_uploads
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [video_uploads]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin write" ON app_settings;
  CREATE POLICY "admin write" ON app_settings
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [app_settings]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "ad_creatives_advertiser_all" ON ad_creatives;
  CREATE POLICY "ad_creatives_advertiser_all" ON ad_creatives
    FOR ALL USING (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = (SELECT auth.uid())));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [ad_creatives]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "org_view_own_brokerage_requests" ON brokerage_requests;
  CREATE POLICY "org_view_own_brokerage_requests" ON brokerage_requests
    FOR SELECT USING (org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())
    ));
  DROP POLICY IF EXISTS "org_insert_brokerage_requests" ON brokerage_requests;
  CREATE POLICY "org_insert_brokerage_requests" ON brokerage_requests
    FOR INSERT WITH CHECK (
      org_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = (SELECT auth.uid()) AND role IN ('owner','branch_manager','agent')
      )
      AND agreed_broker_terms = true
      AND agreed_commission = true
      AND submitted_by = (SELECT auth.uid())
    );
  DROP POLICY IF EXISTS "org_cancel_own_requests" ON brokerage_requests;
  CREATE POLICY "org_cancel_own_requests" ON brokerage_requests
    FOR UPDATE
    USING (
      org_id IN (SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid()) AND role IN ('owner','branch_manager'))
      AND status = 'pending'
    )
    WITH CHECK (status = 'cancelled');
  DROP POLICY IF EXISTS "staff_admin_full_brokerage_access" ON brokerage_requests;
  CREATE POLICY "staff_admin_full_brokerage_access" ON brokerage_requests
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role IN ('admin','staff')));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [brokerage_requests]: %', SQLERRM;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Org members read own entries" ON org_income_entries;
  CREATE POLICY "Org members read own entries" ON org_income_entries
    FOR SELECT USING (org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = (SELECT auth.uid())
    ));
  DROP POLICY IF EXISTS "Tenants read entries they submitted" ON org_income_entries;
  CREATE POLICY "Tenants read entries they submitted" ON org_income_entries
    FOR SELECT USING (submitted_by = (SELECT auth.uid()));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL [org_income_entries]: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: FUNCTIONS (function_search_path_mutable)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  RAISE NOTICE 'DIAGNOSTIC COMPLETE — tazama NOTICE lines hapo juu kwa FAIL entries zozote';
END $$;
