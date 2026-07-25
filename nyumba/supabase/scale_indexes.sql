-- Scale indexes for NyumbaFasta — run in Supabase SQL editor.
-- Covers ads system, agent leads, WhatsApp sessions, social posts,
-- advertisers, legal, staff, and email tables added after the initial schema.
-- All indexes are IF NOT EXISTS — safe to re-run at any time.

-- ── Agent Leads ───────────────────────────────────────────────────────────────

-- Staff leads list (most common filter: assigned_to + stage + created_at)
CREATE INDEX IF NOT EXISTS idx_agent_leads_assigned_stage
  ON agent_leads(assigned_to, pipeline_stage, created_at DESC);

-- Unassigned leads pool (distribute endpoint)
CREATE INDEX IF NOT EXISTS idx_agent_leads_unassigned
  ON agent_leads(assigned_to, created_at DESC)
  WHERE assigned_to IS NULL;

-- Duplicate detection (phone number)
CREATE INDEX IF NOT EXISTS idx_agent_leads_phone
  ON agent_leads(phone);

-- ── Ad Campaigns ─────────────────────────────────────────────────────────────

-- Ad ranking query (active campaigns by type + region)
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status_region_type
  ON ad_campaigns(status, target_region, ad_type);

-- Advertiser dashboard — their own campaigns
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_advertiser
  ON ad_campaigns(advertiser_id, status, created_at DESC);

-- Expiry cron — campaigns expiring soon
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_expires
  ON ad_campaigns(expires_at, status)
  WHERE status IN ('active', 'approved');

-- ── Ad Impressions / Frequency Cap ───────────────────────────────────────────
-- Note: ad_impressions uses 'shown_at' not 'created_at'

-- Frequency cap lookup (per session + campaign)
CREATE INDEX IF NOT EXISTS idx_ad_impressions_session_campaign
  ON ad_impressions(session_id, campaign_id, shown_at DESC);

-- Campaign-level impression count (analytics)
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_date
  ON ad_impressions(campaign_id, shown_at DESC);

-- ── Advertisers ───────────────────────────────────────────────────────────────

-- Admin advertiser list (status filter)
CREATE INDEX IF NOT EXISTS idx_advertisers_status_created
  ON advertisers(status, created_at DESC);

-- ── WhatsApp Sessions ─────────────────────────────────────────────────────────

-- Active sessions list (admin panel — filtered by status)
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status_updated
  ON whatsapp_sessions(status, last_message_at DESC);

-- Per-phone lookup (message panel, takeover, resolve)
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone
  ON whatsapp_sessions(phone_number);

-- ── WhatsApp Messages ─────────────────────────────────────────────────────────

-- Message thread (ordered by creation time)
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_time
  ON whatsapp_messages(phone_number, created_at ASC);

-- ── Social Posts ──────────────────────────────────────────────────────────────

-- Recent posts list (admin social dashboard)
CREATE INDEX IF NOT EXISTS idx_social_posts_created
  ON social_posts(created_at DESC, platform);

-- ── Legal / Violations ────────────────────────────────────────────────────────
-- Note: actual table name is 'agreement_violations' not 'violations'

-- Violation list by status (admin legal panel)
CREATE INDEX IF NOT EXISTS idx_violations_status_created
  ON agreement_violations(status, created_at DESC);

-- Reported user lookup
CREATE INDEX IF NOT EXISTS idx_violations_reported_user
  ON agreement_violations(reported_user_id, status);

-- ── Staff Permissions ─────────────────────────────────────────────────────────

-- Permission check (getPermissions for a staff member)
CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff_key
  ON staff_permissions(staff_id, permission_key);

-- ── Emails ───────────────────────────────────────────────────────────────────

-- Email thread view
CREATE INDEX IF NOT EXISTS idx_emails_thread_time
  ON emails(thread_id, created_at ASC);

-- Sent emails by recipient
CREATE INDEX IF NOT EXISTS idx_emails_to_direction
  ON emails(to_email, direction, created_at DESC);

-- ── Users (role-based queries) ────────────────────────────────────────────────

-- Admin users list — filter by role + is_active
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users(role, is_active, created_at DESC);

-- Staff lookup (leads distribution, permission checks)
CREATE INDEX IF NOT EXISTS idx_users_staff_active
  ON users(role, staff_active, created_at DESC)
  WHERE role = 'staff';

-- ── Message Classifications (inbox) ──────────────────────────────────────────

-- Inbox flagged messages
CREATE INDEX IF NOT EXISTS idx_message_classifications_action
  ON message_classifications(action, created_at DESC);
