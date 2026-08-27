-- ═══════════════════════════════════════════════════════════════════════════
-- perf_fk_indexes_2026_08_27.sql
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS on every index).
--
-- 81 foreign-key columns in public schema had NO covering index (found via
-- direct pg_constraint/pg_index audit — the Supabase linter's performance
-- category doesn't surface this by default). Every join, WHERE filter, or
-- RLS policy check on these columns was doing a full table scan instead of
-- an index lookup. Many of these tables are also touched by
-- delete_user_account()'s cascading cleanup (see
-- fix_delete_user_account_2026_08_22.sql) — an unindexed FK there means a
-- full scan of that table on every single account deletion.
--
-- CREATE INDEX (not CONCURRENTLY) is used here for simplicity via the SQL
-- Editor — on a table with a very large number of rows this briefly locks
-- writes to that table. Given these are FK/reference columns rather than
-- huge blob columns, and most of these tables are low-to-moderate volume
-- (per the row-count query already run), this is expected to be fast. If
-- any single CREATE INDEX here takes unexpectedly long, it's safe to
-- interrupt just that statement and re-run it with CREATE INDEX
-- CONCURRENTLY instead (must be run outside a transaction block if so).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_deleted_by ON public.users(deleted_by);
CREATE INDEX IF NOT EXISTS idx_reports_listing_id ON public.reports(listing_id);
CREATE INDEX IF NOT EXISTS idx_reports_reviewed_by ON public.reports(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_agent_leads_converted_to_profile_id ON public.agent_leads(converted_to_profile_id);
CREATE INDEX IF NOT EXISTS idx_agent_leads_converted_user_id ON public.agent_leads(converted_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_leads_first_listing_id ON public.agent_leads(first_listing_id);
CREATE INDEX IF NOT EXISTS idx_lead_communications_lead_id ON public.lead_communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_communications_user_id ON public.lead_communications(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_to ON public.lead_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_created_by ON public.lead_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id ON public.lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_dalali_id ON public.call_logs(dalali_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_pending_listings_session_id ON public.pending_listings(session_id);
CREATE INDEX IF NOT EXISTS idx_payments_listing_id ON public.payments(listing_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_assigned_admin_id ON public.whatsapp_sessions(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_amina_instructions_admin_id ON public.amina_instructions(admin_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_by ON public.social_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_social_comments_replied_by ON public.social_comments(replied_by);
CREATE INDEX IF NOT EXISTS idx_post_schedule_created_by ON public.post_schedule(created_by);
CREATE INDEX IF NOT EXISTS idx_post_schedule_listing_id ON public.post_schedule(listing_id);
CREATE INDEX IF NOT EXISTS idx_post_schedule_post_id ON public.post_schedule(post_id);
CREATE INDEX IF NOT EXISTS idx_followup_schedules_created_by ON public.followup_schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_agreement_violations_resolved_by ON public.agreement_violations(resolved_by);
CREATE INDEX IF NOT EXISTS idx_spam_keywords_created_by ON public.spam_keywords(created_by);
CREATE INDEX IF NOT EXISTS idx_income_records_listing_id ON public.income_records(listing_id);
CREATE INDEX IF NOT EXISTS idx_expense_records_added_by ON public.expense_records(added_by);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_added_by ON public.recurring_expenses(added_by);
CREATE INDEX IF NOT EXISTS idx_staff_permissions_granted_by ON public.staff_permissions(granted_by);
CREATE INDEX IF NOT EXISTS idx_tiktok_connections_user_id ON public.tiktok_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_click_events_listing_id ON public.profile_click_events(listing_id);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_of ON public.leads(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_leads_linked_user_id ON public.leads(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_advertisers_reviewed_by ON public.advertisers(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_approved_by ON public.ad_campaigns(approved_by);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_creative_id ON public.ad_campaigns(creative_id);
CREATE INDEX IF NOT EXISTS idx_ad_waiting_list_plan_id ON public.ad_waiting_list(plan_id);
CREATE INDEX IF NOT EXISTS idx_staff_documents_uploaded_by ON public.staff_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_staff_payroll_processed_by ON public.staff_payroll(processed_by);
CREATE INDEX IF NOT EXISTS idx_organization_members_invited_by ON public.organization_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_commission_rules_created_by ON public.commission_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_brokerage_commissions_collected_by ON public.brokerage_commissions(collected_by);
CREATE INDEX IF NOT EXISTS idx_brokerage_commissions_rule_id ON public.brokerage_commissions(rule_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_commissions_staff_id ON public.brokerage_commissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_conflict_flags_listing_id ON public.conflict_flags(listing_id);
CREATE INDEX IF NOT EXISTS idx_conflict_flags_resolved_by ON public.conflict_flags(resolved_by);
CREATE INDEX IF NOT EXISTS idx_service_requests_listing_id ON public.service_requests(listing_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_reviewed_by ON public.kyc_submissions(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON public.conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_leases_listing_id ON public.leases(listing_id);
CREATE INDEX IF NOT EXISTS idx_lease_payments_recorded_by ON public.lease_payments(recorded_by);
CREATE INDEX IF NOT EXISTS idx_lease_payments_verified_by ON public.lease_payments(verified_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_conversation_id ON public.maintenance_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_reported_by ON public.maintenance_requests(reported_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_comments_author_id ON public.maintenance_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_created_by ON public.subscription_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_pending_plan_id ON public.organization_subscriptions(pending_plan_id);
CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id ON public.organization_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_organization_banking_created_by ON public.organization_banking(created_by);
CREATE INDEX IF NOT EXISTS idx_vendors_verified_by ON public.vendors(verified_by);
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_reviewed_by ON public.brokerage_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_submitted_by ON public.brokerage_requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_tenant_user_id ON public.brokerage_requests(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_requests_unit_id ON public.brokerage_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_fundi_subscription_plans_created_by ON public.fundi_subscription_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_fundi_subscriptions_plan_id ON public.fundi_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_created_by ON public.knowledge_base(created_by);
CREATE INDEX IF NOT EXISTS idx_cascade_miss_log_pattern_group_id ON public.cascade_miss_log(pattern_group_id);
CREATE INDEX IF NOT EXISTS idx_cascade_pattern_groups_converted_kb_id ON public.cascade_pattern_groups(converted_kb_id);
CREATE INDEX IF NOT EXISTS idx_social_sessions_assigned_admin_id ON public.social_sessions(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_social_handover_messages_sent_by ON public.social_handover_messages(sent_by);
CREATE INDEX IF NOT EXISTS idx_lead_activity_log_actor_id ON public.lead_activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_resolved_by ON public.fraud_signals(resolved_by);
CREATE INDEX IF NOT EXISTS idx_org_recurring_expenses_created_by ON public.org_recurring_expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_sop_id ON public.alert_thresholds(sop_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_acknowledged_by ON public.alert_events(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_alert_events_sop_id ON public.alert_events(sop_id);
CREATE INDEX IF NOT EXISTS idx_org_expenses_recorded_by ON public.org_expenses(recorded_by);
CREATE INDEX IF NOT EXISTS idx_org_income_entries_reviewed_by ON public.org_income_entries(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_org_income_entries_submitted_by ON public.org_income_entries(submitted_by);
CREATE INDEX IF NOT EXISTS idx_department_settings_updated_by ON public.department_settings(updated_by);

DO $$ BEGIN
  RAISE NOTICE 'perf_fk_indexes_2026_08_27.sql complete — 81 foreign-key indexes created.';
END $$;
