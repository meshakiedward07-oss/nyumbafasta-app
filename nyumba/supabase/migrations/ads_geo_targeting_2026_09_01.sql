-- Kata/Wilaya-level ad targeting — 2026-09-01
-- Lets an advertiser target a campaign at one or more wards (kata), a
-- single district (wilaya), or the whole region (mkoa) as before.
-- Run this once in Supabase SQL Editor. Safe to re-run (every insert below
-- is guarded by WHERE NOT EXISTS on plan name, since ad_subscription_plans
-- has no unique constraint on name to rely on ON CONFLICT).

-- 1. New targeting column. target_district already exists but was unused
--    (dead column) in ad-serving logic before this feature.
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS target_wards text[];

COMMENT ON COLUMN ad_campaigns.target_district IS
  'Optional: narrows target_region to one district. NULL = whole region.';
COMMENT ON COLUMN ad_campaigns.target_wards IS
  'Optional: narrows target_district to one or more specific wards (kata). NULL = whole district (or whole region if target_district is also NULL). Requires target_district to be set.';

-- 2. geo_scope on plans — which granularity this plan is priced/sold for.
ALTER TABLE ad_subscription_plans ADD COLUMN IF NOT EXISTS geo_scope text NOT NULL DEFAULT 'region';
DO $$ BEGIN
  ALTER TABLE ad_subscription_plans
    ADD CONSTRAINT ad_subscription_plans_geo_scope_check CHECK (geo_scope IN ('region','district','ward'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Indexes for the slot-availability / ad-serving queries added by this feature
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_district ON ad_campaigns(target_district) WHERE target_district IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_target_wards ON ad_campaigns USING GIN(target_wards) WHERE target_wards IS NOT NULL;

-- 4. Cheaper district/ward-scope plan variants for each existing ad_type.
--    District ≈ 50% of the region price. Ward ≈ 20% of the region price,
--    PER WARD SELECTED — e.g. a 2-kata Nearby/Wiki-1 campaign costs
--    2 × 5,000 = 10,000, computed server-side at payment time from
--    price_tzs × target_wards.length (see pay/initiate/route.ts).
--    slot_limit=1 for every ward-tier plan: one advertiser at a time per
--    kata for that ad type keeps a small area from feeling cluttered and
--    keeps the "kata itakuwa yako pekee" value proposition simple.
--    District tier keeps the same slot_limit as the matching region plan.
--    These are starting prices — adjust anytime in Admin → Adverts → Mipango.

-- features/bundle_types are jsonb; placements is text[] (confirmed via
-- information_schema — mixed types on this table) — the VALUES below carry
-- all three as JSON-array strings for readability, cast/converted to
-- whatever each real column type is.
INSERT INTO ad_subscription_plans (name, ad_type, description, duration_days, price_tzs, slot_limit, features, is_active, display_order, placements, bundle_types, visibility, geo_scope)
SELECT v.name, v.ad_type, v.description, v.duration_days, v.price_tzs, v.slot_limit,
       v.features::jsonb,
       true, v.display_order,
       ARRAY(SELECT jsonb_array_elements_text(v.placements::jsonb)),
       v.bundle_types::jsonb,
       'new_campaign', v.geo_scope
FROM (VALUES
  -- Banner (region: 49,999 / 150,000, slot_limit 1)
  ('Banner — Wilaya, Wiki 1',  'banner', 'Tangazo kubwa juu ya ukurasa wa nyumba, wilaya moja tu, kwa wiki moja.',  7, 25000, 1, '["Nafasi #1 kwa wilaya yako","Bei nafuu kuliko mkoa mzima"]', 11, '["banner"]', '["banner"]', 'district'),
  ('Banner — Wilaya, Mwezi 1', 'banner', 'Tangazo kubwa juu ya ukurasa wa nyumba, wilaya moja tu, kwa mwezi mzima.', 30, 75000, 1, '["Nafasi #1 kwa wilaya yako","Bei nafuu kuliko mkoa mzima"]', 12, '["banner"]', '["banner"]', 'district'),
  ('Banner — Kata, Wiki 1',    'banner', 'Tangazo kubwa juu ya ukurasa wa nyumba, kata unazochagua, kwa wiki moja. Bei kwa kila kata.',  7, 10000, 1, '["Nafasi #1 kwa kata yako","Kwa biashara ndogo — chagua kata 1-2 pekee"]', 13, '["banner"]', '["banner"]', 'ward'),
  ('Banner — Kata, Mwezi 1',   'banner', 'Tangazo kubwa juu ya ukurasa wa nyumba, kata unazochagua, kwa mwezi mzima. Bei kwa kila kata.', 30, 30000, 1, '["Nafasi #1 kwa kata yako","Kwa biashara ndogo — chagua kata 1-2 pekee"]', 14, '["banner"]', '["banner"]', 'ward'),

  -- Search Ad (region: 35,000 / 100,000, slot_limit 2)
  ('Search Ad — Wilaya, Wiki 1',  'search', 'Tangazo kwenye matokeo ya utafutaji, wilaya moja tu, kwa wiki moja.',  7, 18000, 2, '["Lebo Iliyodhaminiwa kwa wilaya yako"]', 21, '["search"]', '["search"]', 'district'),
  ('Search Ad — Wilaya, Mwezi 1', 'search', 'Tangazo kwenye matokeo ya utafutaji, wilaya moja tu, kwa mwezi mzima.', 30, 50000, 2, '["Lebo Iliyodhaminiwa kwa wilaya yako"]', 22, '["search"]', '["search"]', 'district'),
  ('Search Ad — Kata, Wiki 1',    'search', 'Tangazo kwenye matokeo ya utafutaji, kata unazochagua, kwa wiki moja. Bei kwa kila kata.',  7, 7000,  1, '["Kwa biashara ndogo — chagua kata 1-2 pekee"]', 23, '["search"]', '["search"]', 'ward'),
  ('Search Ad — Kata, Mwezi 1',   'search', 'Tangazo kwenye matokeo ya utafutaji, kata unazochagua, kwa mwezi mzima. Bei kwa kila kata.', 30, 20000, 1, '["Kwa biashara ndogo — chagua kata 1-2 pekee"]', 24, '["search"]', '["search"]', 'ward'),

  -- Nearby Ad (region: 25,000 / 70,000, slot_limit 5)
  ('Nearby Ad — Wilaya, Wiki 1',  'nearby', 'Fikia wateja wanaotazama nyumba karibu na wilaya yako, kwa wiki moja.',  7, 13000, 5, '["Wilaya moja tu"]', 31, '["nearby"]', '["nearby"]', 'district'),
  ('Nearby Ad — Wilaya, Mwezi 1', 'nearby', 'Fikia wateja wanaotazama nyumba karibu na wilaya yako, kwa mwezi mzima.', 30, 35000, 5, '["Wilaya moja tu"]', 32, '["nearby"]', '["nearby"]', 'district'),
  ('Nearby Ad — Kata, Wiki 1',    'nearby', 'Fikia wateja wanaotazama nyumba karibu na kata yako, kwa wiki moja. Bei kwa kila kata.',  7, 5000,  1, '["Kwa fundi/biashara inayohudumia kata 1-2 tu"]', 33, '["nearby"]', '["nearby"]', 'ward'),
  ('Nearby Ad — Kata, Mwezi 1',   'nearby', 'Fikia wateja wanaotazama nyumba karibu na kata yako, kwa mwezi mzima. Bei kwa kila kata.', 30, 14000, 1, '["Kwa fundi/biashara inayohudumia kata 1-2 tu"]', 34, '["nearby"]', '["nearby"]', 'ward'),

  -- Video Ad (region: 45,000 / 120,000, slot_limit 3)
  ('Video Ad — Wilaya, Wiki 1',  'video', 'Video ya biashara yako ndani ya feed, wilaya moja tu, kwa wiki moja.',  7, 23000, 3, '["Wilaya moja tu"]', 41, '["video"]', '["video"]', 'district'),
  ('Video Ad — Wilaya, Mwezi 1', 'video', 'Video ya biashara yako ndani ya feed, wilaya moja tu, kwa mwezi mzima.', 30, 60000, 3, '["Wilaya moja tu"]', 42, '["video"]', '["video"]', 'district'),
  ('Video Ad — Kata, Wiki 1',    'video', 'Video ya biashara yako ndani ya feed, kata unazochagua, kwa wiki moja. Bei kwa kila kata.',  7, 9000,  1, '["Kwa biashara ndogo — chagua kata 1-2 pekee"]', 43, '["video"]', '["video"]', 'ward'),
  ('Video Ad — Kata, Mwezi 1',   'video', 'Video ya biashara yako ndani ya feed, kata unazochagua, kwa mwezi mzima. Bei kwa kila kata.', 30, 24000, 1, '["Kwa biashara ndogo — chagua kata 1-2 pekee"]', 44, '["video"]', '["video"]', 'ward'),

  -- Featured Business (region: 80,000/30d, 200,000/90d, slot_limit 10)
  ('Featured Business — Wilaya, Mwezi 1', 'featured', 'Orodhesha biashara yako kwenye directory ya wilaya yako, mwezi mmoja.', 30, 40000,  10, '["Wilaya moja tu"]', 51, '["featured"]', '["featured"]', 'district'),
  ('Featured Business — Wilaya, Miezi 3', 'featured', 'Orodhesha biashara yako kwenye directory ya wilaya yako, miezi mitatu.', 90, 100000, 10, '["Wilaya moja tu","Akiba ya 17%"]', 52, '["featured"]', '["featured"]', 'district'),
  ('Featured Business — Kata, Mwezi 1',   'featured', 'Orodhesha biashara yako kwenye directory ya kata yako, mwezi mmoja. Bei kwa kila kata.', 30, 16000, 1, '["Kwa biashara ndogo — chagua kata 1-2 pekee"]', 53, '["featured"]', '["featured"]', 'ward'),
  ('Featured Business — Kata, Miezi 3',   'featured', 'Orodhesha biashara yako kwenye directory ya kata yako, miezi mitatu. Bei kwa kila kata.', 90, 40000,  1, '["Kwa biashara ndogo — chagua kata 1-2 pekee","Akiba ya 17%"]', 54, '["featured"]', '["featured"]', 'ward')
) AS v(name, ad_type, description, duration_days, price_tzs, slot_limit, features, display_order, placements, bundle_types, geo_scope)
WHERE NOT EXISTS (SELECT 1 FROM ad_subscription_plans p WHERE p.name = v.name);
