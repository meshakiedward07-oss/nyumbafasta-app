-- ════════════════════════════════════════════════════════════════════════
-- SOP & KPI Operating Layer — Phase 3: Alert Thresholds & Events
-- Run AFTER sop_kpi_phase1 and sop_kpi_phase2.
-- ════════════════════════════════════════════════════════════════════════

-- ── alert_thresholds: defines what to watch and when to fire ─────────────────

CREATE TABLE IF NOT EXISTS alert_thresholds (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  metric          TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  description     TEXT,
  operator        TEXT        NOT NULL DEFAULT 'gt'
                              CHECK (operator IN ('gt', 'lt', 'gte', 'lte', 'eq')),
  threshold_value NUMERIC     NOT NULL,
  severity        TEXT        NOT NULL DEFAULT 'warning'
                              CHECK (severity IN ('info', 'warning', 'critical')),
  sop_id          UUID        REFERENCES knowledge_base(id) ON DELETE SET NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── alert_events: one row per alert firing ───────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_events (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  threshold_id     UUID        NOT NULL REFERENCES alert_thresholds(id) ON DELETE CASCADE,
  metric           TEXT        NOT NULL,
  display_name     TEXT        NOT NULL,
  current_value    NUMERIC     NOT NULL,
  threshold_value  NUMERIC     NOT NULL,
  severity         TEXT        NOT NULL,
  sop_id           UUID        REFERENCES knowledge_base(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'acknowledged', 'resolved')),
  acknowledged_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_alert_thresholds_active  ON alert_thresholds(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alert_thresholds_metric  ON alert_thresholds(metric);
CREATE INDEX IF NOT EXISTS idx_alert_events_status      ON alert_events(status);
CREATE INDEX IF NOT EXISTS idx_alert_events_threshold   ON alert_events(threshold_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_severity    ON alert_events(severity);
CREATE INDEX IF NOT EXISTS idx_alert_events_created     ON alert_events(created_at DESC);

-- ── Disable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE alert_thresholds DISABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events     DISABLE ROW LEVEL SECURITY;

-- ── Seed: 6 default thresholds linked to Phase 2 SOPs ────────────────────────
-- Uses subqueries to resolve SOP IDs by slug — safe if slugs don't exist yet
-- (returns NULL for sop_id, which is allowed).

INSERT INTO alert_thresholds (metric, display_name, description, operator, threshold_value, severity, sop_id)
SELECT
  'kyc_pending_count',
  'KYC Zisizokaguliwa',
  'Idadi ya madalali wenye ombi la KYC linalongoja idhini',
  'gt', 5, 'warning',
  (SELECT id FROM knowledge_base WHERE slug = 'sop-uthibitisho-dalali' LIMIT 1)

UNION ALL SELECT
  'kyc_pending_hours',
  'KYC Imesimama (Masaa 24+)',
  'Ombi la KYC lililokuwepo zaidi ya masaa 24 bila jibu — linakiuka SLA',
  'gt', 24, 'critical',
  (SELECT id FROM knowledge_base WHERE slug = 'sop-uthibitisho-dalali' LIMIT 1)

UNION ALL SELECT
  'listings_pending_count',
  'Listings Zinazosubiri Idhini',
  'Listings zilizo na status=pending zinazongoja ukaguzi wa admin',
  'gt', 10, 'warning',
  (SELECT id FROM knowledge_base WHERE slug = 'sop-msaada-wateja' LIMIT 1)

UNION ALL SELECT
  'listings_pending_hours',
  'Listing Imesimama (Masaa 48+)',
  'Listing iliyo pending zaidi ya masaa 48 — inakiuka SLA ya ukaguzi',
  'gt', 48, 'critical',
  (SELECT id FROM knowledge_base WHERE slug = 'sop-msaada-wateja' LIMIT 1)

UNION ALL SELECT
  'payment_failures_1h',
  'Malipo Yaliyoshindwa (Saa 1)',
  'Idadi ya malipo yaliyoshindwa ndani ya saa 1 iliyopita',
  'gt', 5, 'critical',
  (SELECT id FROM knowledge_base WHERE slug = 'sop-fedha-malipo' LIMIT 1)

UNION ALL SELECT
  'new_dalali_no_listing_48h',
  'Madalali Wapya Bila Listings',
  'Madalali waliojisajili zaidi ya masaa 48 iliyopita na bado hawajaweka listing',
  'gt', 3, 'info',
  (SELECT id FROM knowledge_base WHERE slug = 'sop-mauzo-onboarding-dalali' LIMIT 1);
