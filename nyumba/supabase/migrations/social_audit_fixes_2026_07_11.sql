-- Social media audit fixes
-- Run once in Supabase SQL Editor
-- Date: 2026-07-11

-- ── 1. Fix broken TikTok RLS policies (dalali_id column does not exist) ────────
-- tiktok_connections and tiktok_posts are admin-only tables accessed via
-- service_role (supabaseAdmin), which bypasses RLS. Drop the broken policies
-- and replace with admin-only ones that mirror every other admin table.

DROP POLICY IF EXISTS "tiktok_conn_own"  ON tiktok_connections;
DROP POLICY IF EXISTS "tiktok_posts_own" ON tiktok_posts;

DROP POLICY IF EXISTS "admin_tiktok_connections" ON tiktok_connections;
CREATE POLICY "admin_tiktok_connections" ON tiktok_connections
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "admin_tiktok_posts" ON tiktok_posts;
CREATE POLICY "admin_tiktok_posts" ON tiktok_posts
  FOR ALL USING (public.is_admin());

-- ── 2. Add increment_keyword_matches function (was silently failing) ────────────
CREATE OR REPLACE FUNCTION public.increment_keyword_matches(keywords TEXT[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE spam_keywords
  SET match_count = match_count + 1
  WHERE keyword = ANY(keywords);
$$;
