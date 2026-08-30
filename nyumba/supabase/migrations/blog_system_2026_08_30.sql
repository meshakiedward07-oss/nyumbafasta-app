-- ═══════════════════════════════════════════════════════════════════════════
-- blog_system_2026_08_30.sql
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS everywhere).
--
-- New, purely-additive feature: an in-platform blog CMS so admin/staff
-- (with the existing 'social_media' permission — /admin/social already
-- requires it, no new permission key needed) can write and publish SEO
-- content directly, no code/deploy required. Nothing existing is touched.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  excerpt           TEXT,
  content_html      TEXT NOT NULL DEFAULT '',
  cover_image_url   TEXT,
  category          TEXT,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  author_name       TEXT,
  meta_title        TEXT,
  meta_description  TEXT,
  view_count        INT NOT NULL DEFAULT 0,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public blog listing/detail pages filter on (status, published_at) — index
-- covers both the "list published, newest first" and per-slug lookups
-- (slug already has a unique index from the UNIQUE constraint above).
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON public.blog_posts(status, published_at DESC);
-- FK index — added up front this time (see perf_fk_indexes_2026_08_27.sql
-- for the 81 that were missing elsewhere in this schema).
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON public.blog_posts(author_id);

-- updated_at auto-touch, matching the convention used elsewhere in this schema.
CREATE OR REPLACE FUNCTION public.touch_blog_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_blog_posts_updated_at();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public (including anon/guest) can read only published posts — this is
-- what powers /blog and /blog/[slug]. Admin/staff API routes use the
-- service-role client for writes (bypasses RLS, same as every other admin
-- route in this app), so this policy set is a read path plus a
-- defense-in-depth backstop, not the primary write path.
DROP POLICY IF EXISTS blog_public_read ON public.blog_posts;
CREATE POLICY blog_public_read ON public.blog_posts
  FOR SELECT
  USING (status = 'published');

-- Admin/staff can manage all posts (defense-in-depth backstop — the real
-- gate is the 'social_media' permission check in the API routes, since RLS
-- has no easy way to check the staff_permissions table per-request).
DROP POLICY IF EXISTS blog_staff_manage ON public.blog_posts;
CREATE POLICY blog_staff_manage ON public.blog_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND users.role = ANY (ARRAY['admin'::user_role, 'staff'::user_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
        AND users.role = ANY (ARRAY['admin'::user_role, 'staff'::user_role])
    )
  );

-- Called server-side (via the service-role client, from app/blog/[slug]/page.tsx)
-- on every published-post view — SECURITY DEFINER + fixed search_path from
-- the start, matching the pattern already used by increment_view_count()/
-- increment_lead_count() on listings (see security_audit_fix2_2026_07_10.sql).
CREATE OR REPLACE FUNCTION public.increment_blog_view_count(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.blog_posts SET view_count = view_count + 1 WHERE id = p_post_id;
END;
$$;

-- Called only via the service-role client (server component) — same
-- reasoning as start_dalali_trial/delete_user_account in
-- security_hardening_2026_08_27.sql: no client-side code should be able to
-- call this directly, so it's locked to service_role rather than left at
-- the PUBLIC-grants-to-everyone default.
REVOKE EXECUTE ON FUNCTION public.increment_blog_view_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_blog_view_count(UUID) TO service_role;

DO $$ BEGIN
  RAISE NOTICE 'blog_system_2026_08_30.sql complete — blog_posts table + RLS ready.';
END $$;
