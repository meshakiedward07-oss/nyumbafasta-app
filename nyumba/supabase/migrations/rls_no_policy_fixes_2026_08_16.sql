-- rls_no_policy_fixes_2026_08_16.sql
-- Fix rls_enabled_no_policy advisor warnings (INFO level).
-- Adds minimal RLS policies to 15 tables that have RLS enabled but no policies.
--
-- All writes to internal tables go through service_role (supabaseAdmin) which
-- bypasses RLS entirely — policies here only govern direct authenticated access.
-- Safe to re-run: DROP POLICY IF EXISTS throughout.

-- ── 1. ad_impressions ─────────────────────────────────────────────────────────
-- Frequency-capping table. Only service_role writes. Admins can read.

DROP POLICY IF EXISTS "admin_read_ad_impressions" ON ad_impressions;
CREATE POLICY "admin_read_ad_impressions"
  ON ad_impressions FOR SELECT
  USING (public.is_admin());

-- ── 2. alert_thresholds ───────────────────────────────────────────────────────
-- Admin defines KPI alert rules.

DROP POLICY IF EXISTS "admin_all_alert_thresholds" ON alert_thresholds;
CREATE POLICY "admin_all_alert_thresholds"
  ON alert_thresholds FOR ALL
  USING (public.is_admin_or_staff());

-- ── 3. alert_events ───────────────────────────────────────────────────────────
-- One row per alert firing — admin/staff review.

DROP POLICY IF EXISTS "admin_all_alert_events" ON alert_events;
CREATE POLICY "admin_all_alert_events"
  ON alert_events FOR ALL
  USING (public.is_admin_or_staff());

-- ── 4. cascade_config ─────────────────────────────────────────────────────────
-- AI chatbot config (cache thresholds, etc.). Admin can read/update.

DROP POLICY IF EXISTS "admin_all_cascade_config" ON cascade_config;
CREATE POLICY "admin_all_cascade_config"
  ON cascade_config FOR ALL
  USING (public.is_admin());

-- ── 5. cascade_miss_log ───────────────────────────────────────────────────────
-- Unanswered chatbot queries — admin reviews to improve knowledge base.

DROP POLICY IF EXISTS "admin_all_cascade_miss_log" ON cascade_miss_log;
CREATE POLICY "admin_all_cascade_miss_log"
  ON cascade_miss_log FOR ALL
  USING (public.is_admin_or_staff());

-- ── 6. cascade_pattern_groups ─────────────────────────────────────────────────
-- Grouped miss patterns — admin converts to KB articles.

DROP POLICY IF EXISTS "admin_all_cascade_pattern_groups" ON cascade_pattern_groups;
CREATE POLICY "admin_all_cascade_pattern_groups"
  ON cascade_pattern_groups FOR ALL
  USING (public.is_admin_or_staff());

-- ── 7. device_sessions ────────────────────────────────────────────────────────
-- Fraud detection: device fingerprints. Writes via service_role; admin reads.

DROP POLICY IF EXISTS "admin_read_device_sessions" ON device_sessions;
CREATE POLICY "admin_read_device_sessions"
  ON device_sessions FOR SELECT
  USING (public.is_admin_or_staff());

-- ── 8. emails ─────────────────────────────────────────────────────────────────
-- In-app email log. Admin/staff manage. Inbound webhook uses service_role.

DROP POLICY IF EXISTS "staff_read_emails"   ON emails;
DROP POLICY IF EXISTS "staff_insert_emails" ON emails;
DROP POLICY IF EXISTS "staff_update_emails" ON emails;

CREATE POLICY "staff_read_emails"
  ON emails FOR SELECT
  USING (public.is_admin_or_staff());

CREATE POLICY "staff_insert_emails"
  ON emails FOR INSERT
  WITH CHECK (public.is_admin_or_staff());

CREATE POLICY "staff_update_emails"
  ON emails FOR UPDATE
  USING (public.is_admin_or_staff());

-- ── 9. fraud_signals ──────────────────────────────────────────────────────────
-- Fraud review dashboard — admin reads and resolves signals.

DROP POLICY IF EXISTS "admin_all_fraud_signals" ON fraud_signals;
CREATE POLICY "admin_all_fraud_signals"
  ON fraud_signals FOR ALL
  USING (public.is_admin_or_staff());

-- ── 10. ip_activity_log ───────────────────────────────────────────────────────
-- IP log for fraud patterns. Writes via service_role; admin reads.

DROP POLICY IF EXISTS "admin_read_ip_activity_log" ON ip_activity_log;
CREATE POLICY "admin_read_ip_activity_log"
  ON ip_activity_log FOR SELECT
  USING (public.is_admin_or_staff());

-- ── 11. knowledge_base ────────────────────────────────────────────────────────
-- Chatbot knowledge articles. Admin creates/edits; chatbot reads via service_role.

DROP POLICY IF EXISTS "admin_all_knowledge_base" ON knowledge_base;
CREATE POLICY "admin_all_knowledge_base"
  ON knowledge_base FOR ALL
  USING (public.is_admin_or_staff());

-- ── 12. knowledge_cache ───────────────────────────────────────────────────────
-- Auto-growing cache of Amina answers. Writes via service_role; admin reads.

DROP POLICY IF EXISTS "admin_read_knowledge_cache" ON knowledge_cache;
CREATE POLICY "admin_read_knowledge_cache"
  ON knowledge_cache FOR SELECT
  USING (public.is_admin_or_staff());

-- ── 13. owner_reply_templates ─────────────────────────────────────────────────
-- Quick-reply templates for the admin inbox. All access via supabaseAdmin.

DROP POLICY IF EXISTS "admin_all_owner_reply_templates" ON owner_reply_templates;
CREATE POLICY "admin_all_owner_reply_templates"
  ON owner_reply_templates FOR ALL
  USING (public.is_admin());

-- ── 14. payment_refunds ───────────────────────────────────────────────────────
-- Manual refund records — admin only.

DROP POLICY IF EXISTS "admin_all_payment_refunds" ON payment_refunds;
CREATE POLICY "admin_all_payment_refunds"
  ON payment_refunds FOR ALL
  USING (public.is_admin_or_staff());

-- ── 15. vendors ───────────────────────────────────────────────────────────────
-- Org vendor directory. Org members read/write their own org's vendors; admin all.

DROP POLICY IF EXISTS "org_manage_own_vendors" ON vendors;
DROP POLICY IF EXISTS "admin_all_vendors"       ON vendors;

CREATE POLICY "org_manage_own_vendors"
  ON vendors FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "admin_all_vendors"
  ON vendors FOR ALL
  USING (public.is_admin_or_staff());

DO $$ BEGIN
  RAISE NOTICE 'rls_no_policy_fixes_2026_08_16.sql complete — 15 tables patched';
END $$;
