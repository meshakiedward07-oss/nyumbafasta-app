-- ════════════════════════════════════════════════════════════════════════
-- Knowledge-First Layer — Phase 1
-- No external embedding API — uses pg_trgm (cache) + PostgreSQL FTS (KB)
-- + Claude Haiku (picks best KB match from FTS candidates).
-- Run in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════

-- pg_trgm: trigram similarity for cache near-duplicate lookup
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── knowledge_base ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_base (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT        NOT NULL UNIQUE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'general',
  language    TEXT        NOT NULL DEFAULT 'sw',
  -- FTS vector auto-maintained by Postgres — no manual embedding step needed
  fts_vector  TSVECTOR    GENERATED ALWAYS AS (
                to_tsvector('simple', title || ' ' || body)
              ) STORED,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── knowledge_cache ───────────────────────────────────────────────────────────
-- Auto-grows as Amina answers questions; trigram index enables similarity lookup.

CREATE TABLE IF NOT EXISTS knowledge_cache (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  hit_count   INTEGER     NOT NULL DEFAULT 0,
  source      TEXT        NOT NULL DEFAULT 'amina_answer'
                          CHECK (source IN ('amina_answer', 'admin_authored')),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  last_hit_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── cascade_miss_log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cascade_miss_log (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number            TEXT,
  session_id              TEXT,
  flow_type               TEXT,
  message_text            TEXT        NOT NULL,
  layer_reached           TEXT        NOT NULL
                          CHECK (layer_reached IN ('cache','knowledge_base','search','amina','handover')),
  best_cache_similarity   FLOAT,
  best_kb_similarity      FLOAT,
  search_returned_results BOOLEAN,
  invoked_amina           BOOLEAN     NOT NULL DEFAULT false,
  amina_response          TEXT,
  handover_triggered      BOOLEAN     NOT NULL DEFAULT false,
  reviewed                BOOLEAN     NOT NULL DEFAULT false,
  pattern_group_id        UUID,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ── cascade_pattern_groups ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cascade_pattern_groups (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  label            TEXT        NOT NULL,
  sample_questions TEXT[]      NOT NULL DEFAULT '{}',
  hit_count        INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'converted_to_kb')),
  converted_kb_id  UUID        REFERENCES knowledge_base(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cascade_miss_log
  ADD CONSTRAINT fk_miss_pattern
  FOREIGN KEY (pattern_group_id) REFERENCES cascade_pattern_groups(id) ON DELETE SET NULL;

-- ── cascade_config ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cascade_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT
);

INSERT INTO cascade_config (key, value, description) VALUES
  ('cache_similarity_threshold', '0.40', 'pg_trgm trigram similarity floor (0-1) to return a cached answer'),
  ('kb_confidence_threshold',    '0.75', 'Haiku confidence floor (0-1) to return a KB article directly'),
  ('max_context_items',          '3',    'KB items injected into Amina context per call (Phase 4)')
ON CONFLICT (key) DO NOTHING;

-- ── Indices ───────────────────────────────────────────────────────────────────

-- FTS on knowledge_base
CREATE INDEX IF NOT EXISTS idx_kb_fts      ON knowledge_base USING gin(fts_vector);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_kb_active   ON knowledge_base(is_active) WHERE is_active = true;

-- Trigram index on knowledge_cache.question for similarity()
CREATE INDEX IF NOT EXISTS idx_kc_question_trgm ON knowledge_cache USING gin(question gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kc_active         ON knowledge_cache(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kc_hit            ON knowledge_cache(hit_count DESC);

-- Miss log
CREATE INDEX IF NOT EXISTS idx_miss_created  ON cascade_miss_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_miss_reviewed ON cascade_miss_log(reviewed) WHERE reviewed = false;
CREATE INDEX IF NOT EXISTS idx_miss_layer    ON cascade_miss_log(layer_reached);
CREATE INDEX IF NOT EXISTS idx_miss_phone    ON cascade_miss_log(phone_number) WHERE phone_number IS NOT NULL;

-- ── Disable RLS ───────────────────────────────────────────────────────────────

ALTER TABLE knowledge_base         DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_cache        DISABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_miss_log       DISABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_pattern_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_config         DISABLE ROW LEVEL SECURITY;

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- 1. FTS candidate retrieval for KB lookup
--    Called by the app before passing candidates to Haiku.
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
      AND kb.fts_vector @@ plainto_tsquery('simple', p_query)
    ORDER BY ts_rank(kb.fts_vector, plainto_tsquery('simple', p_query)) DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_kb_candidates(TEXT, INT) TO service_role;

-- 2. pg_trgm cache lookup — pure similarity, no AI
CREATE OR REPLACE FUNCTION nf_cache_lookup(
  p_question  TEXT,
  p_threshold FLOAT DEFAULT 0.40,
  p_limit     INT   DEFAULT 1
)
RETURNS TABLE (id UUID, answer TEXT, similarity FLOAT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT
      kc.id,
      kc.answer,
      similarity(kc.question, p_question) AS similarity
    FROM knowledge_cache kc
    WHERE kc.is_active = true
      AND similarity(kc.question, p_question) >= p_threshold
    ORDER BY similarity DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_cache_lookup(TEXT, FLOAT, INT) TO service_role;

-- 3. Hit counter increment
CREATE OR REPLACE FUNCTION nf_increment_cache_hit(p_cache_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE knowledge_cache
     SET hit_count   = hit_count + 1,
         last_hit_at = NOW()
   WHERE id = p_cache_id;
END;
$$;

GRANT EXECUTE ON FUNCTION nf_increment_cache_hit(UUID) TO service_role;

-- ════════════════════════════════════════════════════════════════════════
-- SEED: 20 initial Kiswahili FAQ articles
-- FTS vectors are GENERATED ALWAYS AS — no embedding step needed.
-- Articles are searchable immediately after this INSERT.
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO knowledge_base (slug, title, body, category, language) VALUES

('bei-ya-kufungua-mawasiliano', 'Bei ya kufungua mawasiliano ya dalali',
'Kufungua nambari ya simu ya dalali kunakugharimu Tsh 2,000 peke yake. Malipo hufanywa kwa M-Pesa, Airtel Money, au Tigo Pesa — hakuna ada nyingine za siri. Baada ya kulipa utapata nambari ya WhatsApp ya dalali moja kwa moja.',
'pricing', 'sw'),

('bei-ya-subscription-dalali', 'Bei ya usajili wa dalali',
'Mipango ya dalali ni: Basic Tsh 10,000 kwa mwezi (listings 5), Premium Tsh 25,000 kwa mwezi (listings 20, boost, verified badge, analytics). Malipo yanafanywa kwa M-Pesa, Airtel Money, au Tigo Pesa.',
'pricing', 'sw'),

('jinsi-ya-kulipa', 'Jinsi ya kulipa kwenye NyumbaFasta',
'Unaweza kulipa kwa M-Pesa, Airtel Money, au Tigo Pesa. Weka namba yako ya simu, utapata ujumbe wa kuthibitisha malipo (STK Push). Thibitisha na PIN yako. Malipo yanakamilika papo hapo.',
'payments', 'sw'),

('malipo-yameshindwa', 'Malipo yangu yameshindwa — nifanye nini?',
'Kama malipo yameshindwa: (1) Hakikisha una salio la kutosha. (2) Jaribu tena baada ya dakika 5. (3) Tumia namba tofauti ya simu kama una nyingine. (4) Wasiliana nasi kwa WhatsApp kama tatizo linaendelea.',
'payments', 'sw'),

('jinsi-ya-kusajiliwa-dalali', 'Jinsi ya kusajiliwa kama dalali',
'Kusajiliwa kama dalali ni rahisi: (1) Andika "Nataka kuwa dalali" au chagua chaguo 2 kwenye menyu. (2) Weka jina lako kamili. (3) Weka namba ya simu. (4) Weka eneo unalofanya kazi. (5) Thibitisha masharti. Utapata akaunti ndani ya dakika chache. Kisha lipa subscription ili uanze kupost.',
'registration', 'sw'),

('mahitaji-ya-kusajiliwa', 'Mahitaji ya kusajiliwa kama dalali',
'Unahitaji: namba ya simu ya Tanzania inayofanya kazi, jina lako kamili, na eneo unalofanya kazi. Hakuna hati maalum zinazohitajika wakati wa usajili — unaweza kuanza mara moja.',
'registration', 'sw'),

('jinsi-ya-kupost-listing', 'Jinsi ya kupost nyumba kwenye NyumbaFasta',
'Hatua za kupost nyumba: (1) Ingia akaunti yako ya dalali. (2) Chagua "Post Nyumba" kwenye menyu. (3) Weka aina ya nyumba, bei, mahali, na maelezo. (4) Pakia picha hadi 10. (5) Tuma — itakaguliwa na admin ndani ya saa 24.',
'listings', 'sw'),

('listings-zinapitiwa', 'Listing yangu inapitiwa — itachukua muda gani?',
'Kaguzi ya listing inachukua saa 24 kwa kawaida, mara nyingi haraka zaidi. Utapata arifa ya WhatsApp mara listing yako inapoidhinishwa au kukataliwa. Kama imepita saa 48 bila jibu, wasiliana nasi.',
'listings', 'sw'),

('listing-yalikataliwa', 'Listing yangu ilikataliwa — kwa nini?',
'Sababu za kawaida za kukataliwa: picha hazionekani vizuri, bei haikuandikwa vizuri, maelezo hayatoshi, au listing inaonekana bandia. Rekebisha na uwasilishe tena. Admin ataeleza sababu kwenye arifa.',
'listings', 'sw'),

('jinsi-ya-kupata-nambari-dalali', 'Jinsi ya kupata namba ya dalali',
'Bonyeza "Wasiliana na Dalali" kwenye listing unayoipenda. Lipa Tsh 2,000 kwa simu yako. Baada ya kulipa, namba ya WhatsApp ya dalali itafunuliwa mara moja. Unaweza kuwasiliana naye moja kwa moja.',
'contact_unlocks', 'sw'),

('nimefungua-lakini-sina-nambari', 'Nimelipa lakini sijapata namba ya dalali',
'Kama umelipa lakini namba haijafunuliwa: (1) Subiri dakika 2-3 kwa malipo kukamilika. (2) Onyesha upya ukurasa. (3) Angalia katika "Nyumba Zilizofunguliwa" kwenye akaunti yako. (4) Kama bado hakuna, wasiliana nasi na namba ya uthibitisho wa malipo.',
'contact_unlocks', 'sw'),

('nimesahau-nenosiri', 'Nimesahau nenosiri langu — nifanye nini?',
'Bonyeza "Umesahau Nenosiri?" kwenye ukurasa wa kuingia. Weka barua pepe yako. Utapata kiungo cha kubadilisha nenosiri. Kama huna barua pepe au hujui uliyosajiliwa, wasiliana nasi.',
'account', 'sw'),

('jinsi-ya-kubadilisha-nambari', 'Jinsi ya kubadilisha namba ya simu kwenye akaunti',
'Nenda kwenye Akaunti > Mipangilio > Namba ya Simu. Weka namba mpya. Utapata OTP kwa namba mpya — weka ili kuthibitisha. Namba yako itabadilishwa mara moja.',
'account', 'sw'),

('nyumbafasta-ni-nini', 'NyumbaFasta ni nini?',
'NyumbaFasta ni mfumo wa Tanzania unaowasilisha watu wanaotafuta nyumba na madalali wa kuaminika. Unaweza kutafuta vyumba, nyumba, na ofisi kwa bei nafuu na haraka. Madalali wanapost listings, wateja wanalipa kidogo kupata mawasiliano yao.',
'general', 'sw'),

('usalama-wa-malipo', 'Je, malipo yangu ni salama?',
'Ndiyo. NyumbaFasta inatumia mfumo salama wa malipo kupitia Selcom (M-Pesa, Airtel, Tigo). Hatuhifadhi namba za PIN wala taarifa za benki. Kila malipo yana uthibitisho wa mara moja.',
'general', 'sw'),

('tafuta-nyumba-dar', 'Kutafuta nyumba au chumba Dar es Salaam',
'Tunayo listings nyingi Dar es Salaam: Kinondoni, Kariakoo, Mikocheni, Mbezi, Sinza, Kijitonyama, Masaki, na zaidi. Niambie mtaa unaotaka na aina ya nyumba ili nikusaidie kupata.',
'search', 'sw'),

('dalali-mikoa-yote', 'Je, NyumbaFasta ina madalali mikoa yote Tanzania?',
'NyumbaFasta ina madalali katika mikoa yote 31 ya Tanzania, ikiwa ni pamoja na Dar es Salaam, Arusha, Mwanza, Dodoma, Zanzibar, Kilimanjaro, Mbeya, na zaidi. Niambie mkoa wako ili nikuonyeshe madalali waliopo.',
'general', 'sw'),

('hakuna-listings-eneo', 'Hakuna listings katika eneo langu — nifanye nini?',
'Kama hatujafikia eneo lako bado: (1) Jiandikishe ili tupate arifa tunapopata listings huko. (2) Wasiliana na dalali wa karibu — wanajua maeneo jirani pia. (3) Rudi baadaye — tunaongeza listings kila siku.',
'search', 'sw'),

('ninahitaji-haraka', 'Ninahitaji nyumba haraka',
'Sawa, nitakusaidia upate haraka! Niambie: (1) Unatafuta eneo gani? (2) Chumba kimoja au zaidi? (3) Bei yako ya juu ni ngapi kwa mwezi? Nitakupelekea madalali wanaoweza kukusaidia leo hii.',
'search', 'sw'),

('jinsi-ya-kuwasiliana-support', 'Jinsi ya kuwasiliana na msaada wa NyumbaFasta',
'Unaweza kuwasiliana nasi kwa WhatsApp kupitia namba hii, au kupitia tovuti yetu nyumbafasta.co. Masaa ya kazi: 8am - 8pm kila siku. Kwa masuala ya dharura, tutajibu haraka iwezekanavyo.',
'support', 'sw')

ON CONFLICT (slug) DO NOTHING;
