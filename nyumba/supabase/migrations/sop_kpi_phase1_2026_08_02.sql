-- ════════════════════════════════════════════════════════════════════════
-- SOP & KPI Operating Layer — Phase 1
-- Extends knowledge_base to support internal SOPs alongside external FAQs.
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════

-- ── New columns on knowledge_base ────────────────────────────────────────────
--
-- audience:         'external' = customer-facing FAQ (visible to Amina)
--                   'internal' = staff SOP (never sent to Amina)
-- owner_role:       which role "owns" this SOP (e.g. 'admin', 'staff')
-- sla_description:  free-text SLA / expected outcome for this procedure
-- review_frequency: how often this SOP should be reviewed (e.g. 'monthly')
-- last_reviewed_at: timestamp of the last review

DO $$ BEGIN
  ALTER TABLE knowledge_base
    ADD COLUMN audience TEXT NOT NULL DEFAULT 'external'
      CHECK (audience IN ('external', 'internal'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_base ADD COLUMN owner_role TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_base ADD COLUMN sla_description TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_base ADD COLUMN review_frequency TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE knowledge_base ADD COLUMN last_reviewed_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Index so the admin filter and RPC WHERE clause both use the index
CREATE INDEX IF NOT EXISTS idx_kb_audience ON knowledge_base(audience);

-- ── Update nf_kb_candidates to ONLY return external articles ─────────────────
--
-- This is the security gate: internal SOPs must never reach Amina.
-- The RPC is called exclusively from the cascade; updating it here means
-- no app-layer changes are needed to keep SOPs out of Amina's context.

CREATE OR REPLACE FUNCTION nf_kb_candidates(
  p_query TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (id UUID, slug TEXT, title TEXT, body TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kb.id,
      kb.slug,
      kb.title,
      kb.body
    FROM knowledge_base kb
    WHERE kb.is_active = true
      AND kb.audience = 'external'
      AND kb.fts_vector @@ plainto_tsquery('simple', p_query)
    ORDER BY ts_rank(kb.fts_vector, plainto_tsquery('simple', p_query)) DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_kb_candidates(TEXT, INT) TO service_role;
