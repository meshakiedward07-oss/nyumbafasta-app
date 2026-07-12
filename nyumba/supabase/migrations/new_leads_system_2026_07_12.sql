-- ═══════════════════════════════════════════════════════
-- NEW LEADS SYSTEM — Run once in Supabase SQL Editor
-- Date: 2026-07-12
-- ═══════════════════════════════════════════════════════

-- ── IMPORT BATCHES TABLE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_import_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  duplicates_found INTEGER DEFAULT 0,
  dead_leads_found INTEGER DEFAULT 0,
  active_leads INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── LEADS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Basic info
  full_name TEXT NOT NULL,
  phone TEXT,
  phone_2 TEXT,
  email TEXT,
  ward TEXT,
  district TEXT,
  region TEXT DEFAULT 'Dar es Salaam',
  address TEXT,

  -- Lead classification
  lead_type TEXT DEFAULT 'dalali',
  source TEXT DEFAULT 'manual',
  notes TEXT,

  -- Social media links
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  whatsapp_number TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,

  -- Social verification status
  facebook_status TEXT DEFAULT 'unchecked',
  instagram_status TEXT DEFAULT 'unchecked',
  tiktok_status TEXT DEFAULT 'unchecked',
  whatsapp_status TEXT DEFAULT 'unchecked',

  facebook_verified_at TIMESTAMPTZ,
  instagram_verified_at TIMESTAMPTZ,
  tiktok_verified_at TIMESTAMPTZ,
  whatsapp_verified_at TIMESTAMPTZ,

  social_score INTEGER DEFAULT 0,

  -- Contact quality (computed by trigger)
  contact_quality TEXT DEFAULT 'unknown',
  has_valid_phone BOOLEAN DEFAULT false,
  has_valid_email BOOLEAN DEFAULT false,
  has_any_social BOOLEAN DEFAULT false,
  is_dead_lead BOOLEAN DEFAULT false,

  -- Duplicate detection
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of UUID REFERENCES leads(id) ON DELETE SET NULL,
  duplicate_reason TEXT,
  name_similarity_score NUMERIC,

  -- CRM
  status TEXT DEFAULT 'new',
  contacted_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  assigned_to TEXT,

  -- Import metadata
  import_batch_id UUID REFERENCES lead_import_batches(id) ON DELETE SET NULL,
  import_row_number INTEGER,
  original_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(full_name);
CREATE INDEX IF NOT EXISTS idx_leads_ward ON leads(ward) WHERE ward IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, contact_quality);
CREATE INDEX IF NOT EXISTS idx_leads_duplicate ON leads(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_leads_dead ON leads(is_dead_lead);
CREATE INDEX IF NOT EXISTS idx_leads_batch ON leads(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_social_score ON leads(social_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(lead_type, status);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_leads_fts ON leads
  USING gin(to_tsvector('simple',
    coalesce(full_name, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(ward, '') || ' ' ||
    coalesce(district, '')
  ));

-- ── RLS ──────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_leads" ON leads;
CREATE POLICY "service_role_leads" ON leads
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_leads" ON leads;
CREATE POLICY "admin_leads" ON leads
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "service_role_batches" ON lead_import_batches;
CREATE POLICY "service_role_batches" ON lead_import_batches
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_batches" ON lead_import_batches;
CREATE POLICY "admin_batches" ON lead_import_batches
  FOR ALL USING (public.is_admin());

-- ── QUALITY TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_lead_quality()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.has_valid_phone := NEW.phone IS NOT NULL AND LENGTH(TRIM(NEW.phone)) >= 9;
  NEW.has_valid_email := NEW.email IS NOT NULL AND NEW.email LIKE '%@%';
  NEW.has_any_social  := (
    NEW.facebook_url IS NOT NULL OR
    NEW.instagram_url IS NOT NULL OR
    NEW.tiktok_url IS NOT NULL OR
    NEW.whatsapp_number IS NOT NULL
  );
  NEW.social_score := (
    CASE WHEN NEW.facebook_status  = 'active' THEN 25 ELSE 0 END +
    CASE WHEN NEW.instagram_status = 'active' THEN 25 ELSE 0 END +
    CASE WHEN NEW.tiktok_status    = 'active' THEN 25 ELSE 0 END +
    CASE WHEN NEW.whatsapp_status  = 'active' THEN 25 ELSE 0 END
  );
  IF NOT NEW.has_valid_phone AND NOT NEW.has_any_social THEN
    NEW.contact_quality := 'dead';
    NEW.is_dead_lead := true;
  ELSIF NEW.has_valid_phone AND NEW.social_score >= 25 THEN
    NEW.contact_quality := 'high';
    NEW.is_dead_lead := false;
  ELSIF NEW.has_valid_phone OR NEW.social_score >= 25 THEN
    NEW.contact_quality := 'medium';
    NEW.is_dead_lead := false;
  ELSE
    NEW.contact_quality := 'low';
    NEW.is_dead_lead := false;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_quality ON leads;
CREATE TRIGGER trg_lead_quality
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_lead_quality();

-- ── VERIFY ───────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('leads', 'lead_import_batches')
ORDER BY table_name;
