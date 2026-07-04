-- RLS for all tables that were missing row-level security
-- All these tables are accessed exclusively via the service role (createAdminClient).
-- The service role bypasses RLS, so "USING (false)" policies block direct PostgREST
-- access from JWT clients while leaving the API layer fully functional.
-- Run in Supabase SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. whatsapp_conversations  (has explicit DISABLE — must enable + lock)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON whatsapp_conversations;
CREATE POLICY "service_role_only" ON whatsapp_conversations
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. whatsapp_sessions / whatsapp_messages / whatsapp_broadcasts / amina_instructions
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE whatsapp_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_broadcasts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE amina_instructions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON whatsapp_sessions;
CREATE POLICY "service_role_only" ON whatsapp_sessions
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON whatsapp_messages;
CREATE POLICY "service_role_only" ON whatsapp_messages
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON whatsapp_broadcasts;
CREATE POLICY "service_role_only" ON whatsapp_broadcasts
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON amina_instructions;
CREATE POLICY "service_role_only" ON amina_instructions
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Accounting tables (financial data — admin API only)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE income_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON income_records;
CREATE POLICY "service_role_only" ON income_records
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON expense_records;
CREATE POLICY "service_role_only" ON expense_records
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON financial_summaries;
CREATE POLICY "service_role_only" ON financial_summaries
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON recurring_expenses;
CREATE POLICY "service_role_only" ON recurring_expenses
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Social media automation
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE social_posts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_dms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON social_posts;
CREATE POLICY "service_role_only" ON social_posts
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON social_comments;
CREATE POLICY "service_role_only" ON social_comments
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON social_dms;
CREATE POLICY "service_role_only" ON social_dms
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON post_schedule;
CREATE POLICY "service_role_only" ON post_schedule
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Social groups + stories
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE fb_posting_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_stories   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON fb_posting_groups;
CREATE POLICY "service_role_only" ON fb_posting_groups
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON facebook_group_posts;
CREATE POLICY "service_role_only" ON facebook_group_posts
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON instagram_stories;
CREATE POLICY "service_role_only" ON instagram_stories
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Carousel posts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE carousel_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON carousel_posts;
CREATE POLICY "service_role_only" ON carousel_posts
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Marketplace listings + inquiries
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_listings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON marketplace_listings;
CREATE POLICY "service_role_only" ON marketplace_listings
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON marketplace_inquiries;
CREATE POLICY "service_role_only" ON marketplace_inquiries
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Spam detection
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE spam_comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_keywords           ENABLE ROW LEVEL SECURITY;
ALTER TABLE spam_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_performance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON spam_comments;
CREATE POLICY "service_role_only" ON spam_comments
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON spam_keywords;
CREATE POLICY "service_role_only" ON spam_keywords
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON spam_accounts;
CREATE POLICY "service_role_only" ON spam_accounts
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON post_performance;
CREATE POLICY "service_role_only" ON post_performance
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON posting_recommendations;
CREATE POLICY "service_role_only" ON posting_recommendations
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Listing analytics (viewer IPs — PII)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE listing_views          ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_contact_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only" ON listing_views;
CREATE POLICY "service_role_only" ON listing_views
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "service_role_only" ON listing_contact_clicks;
CREATE POLICY "service_role_only" ON listing_contact_clicks
  USING (false) WITH CHECK (false);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Neighborhood cache (public read is acceptable — no PII)
--     Writes are service-role-only (default-deny when no INSERT policy exists)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE neighborhood_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON neighborhood_cache;
CREATE POLICY "public_read" ON neighborhood_cache
  FOR SELECT USING (true);
