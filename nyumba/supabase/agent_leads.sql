-- Lead Generation Agent – agent_leads table
-- Run in Supabase SQL Editor after schema.sql

-- ── agent_leads ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lead contact info
  full_name         TEXT,
  phone             TEXT,
  whatsapp_number   TEXT,
  email             TEXT,
  business_name     TEXT,

  -- Location
  region            TEXT,
  district          TEXT,
  address           TEXT,

  -- Scraping source
  source            TEXT NOT NULL
                      CHECK (source IN ('google_maps', 'facebook', 'instagram', 'manual')),
  source_url        TEXT,
  source_id         TEXT,   -- unique ID from Apify (place_id, fb post id, etc.)

  -- Claude AI analysis
  ai_score          INTEGER CHECK (ai_score BETWEEN 0 AND 100),
  ai_notes          TEXT,
  ai_analyzed_at    TIMESTAMPTZ,

  -- Outreach pipeline
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN (
                        'new', 'contacted', 'interested', 'converted', 'rejected', 'duplicate'
                      )),
  contacted_at      TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,
  converted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Full raw payload from Apify
  raw_data          JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate scrapes from same platform
  UNIQUE (source, source_id)
);

-- Auto-update updated_at (reuses existing function)
DROP TRIGGER IF EXISTS agent_leads_updated_at ON agent_leads;
CREATE TRIGGER agent_leads_updated_at
  BEFORE UPDATE ON agent_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS agent_leads_status_idx  ON agent_leads (status);
CREATE INDEX IF NOT EXISTS agent_leads_region_idx  ON agent_leads (region);
CREATE INDEX IF NOT EXISTS agent_leads_source_idx  ON agent_leads (source);
CREATE INDEX IF NOT EXISTS agent_leads_score_idx   ON agent_leads (ai_score DESC);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE agent_leads ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write leads
CREATE POLICY "admin_read_leads" ON agent_leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_write_leads" ON agent_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role bypass (used by API routes with supabaseAdmin)
-- No policy needed — service_role bypasses RLS automatically
