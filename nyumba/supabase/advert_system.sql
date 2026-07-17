-- ═══════════════════════════════════════════════════════════════════════════
-- NyumbaFasta — Advert System Migration
-- Run this entire script in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Advertisers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advertisers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name     text NOT NULL,
  business_category text NOT NULL,
  contact_phone     text NOT NULL,
  whatsapp_number   text,
  email             text NOT NULL,
  city              text NOT NULL,
  district          text,
  description       text,
  logo_url          text,
  website_url       text,
  status            text NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review','active','rejected','suspended')),
  rejection_reason  text,
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advertisers_user_id_idx ON advertisers(user_id);
CREATE INDEX IF NOT EXISTS advertisers_status_idx  ON advertisers(status);
CREATE INDEX IF NOT EXISTS advertisers_city_idx    ON advertisers(city);

-- ── 2. Ad Subscription Plans (admin-managed) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_subscription_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  ad_type         text NOT NULL
                  CHECK (ad_type IN ('banner','search','nearby','video','featured')),
  description     text,
  duration_days   int  NOT NULL DEFAULT 30,
  price_tzs       int  NOT NULL,
  slot_limit      int  NOT NULL DEFAULT 1,
  features        jsonb        DEFAULT '[]',
  is_active       bool NOT NULL DEFAULT true,
  display_order   int  NOT NULL DEFAULT 0,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

-- ── 3. Ad Campaigns ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id     uuid NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  plan_id           uuid NOT NULL REFERENCES ad_subscription_plans(id),
  ad_type           text NOT NULL
                    CHECK (ad_type IN ('banner','search','nearby','video','featured')),
  status            text NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN (
                      'pending_review','approved','active','expired',
                      'rejected','paused','suspended'
                    )),
  payment_status    text NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','completed','failed')),
  title             text NOT NULL,
  body_text         text,
  image_url         text,
  video_url         text,
  cta_type          text NOT NULL DEFAULT 'whatsapp'
                    CHECK (cta_type IN ('whatsapp','call','website')),
  cta_value         text NOT NULL,
  target_region     text NOT NULL,
  target_district   text,
  target_category   text,
  starts_at         timestamptz,
  expires_at        timestamptz,
  admin_note        text,
  approved_by       uuid REFERENCES users(id),
  approved_at       timestamptz,
  impressions       int  NOT NULL DEFAULT 0,
  clicks            int  NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_campaigns_status_idx     ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS ad_campaigns_type_region    ON ad_campaigns(ad_type, target_region);
CREATE INDEX IF NOT EXISTS ad_campaigns_expires_active ON ad_campaigns(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS ad_campaigns_advertiser_idx ON ad_campaigns(advertiser_id);

-- ── 4. Ad Payments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  advertiser_id       uuid NOT NULL REFERENCES advertisers(id),
  amount              int  NOT NULL,
  currency            text NOT NULL DEFAULT 'TZS',
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','completed','failed')),
  external_id         text UNIQUE NOT NULL,
  provider            text,
  phone_number        text NOT NULL,
  transaction_id      text,
  gateway_reference   text,
  callback_url        text,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_payments_campaign_idx    ON ad_payments(campaign_id);
CREATE INDEX IF NOT EXISTS ad_payments_external_id_idx ON ad_payments(external_id);
CREATE INDEX IF NOT EXISTS ad_payments_advertiser_idx  ON ad_payments(advertiser_id);

-- ── 5. Ad Waiting List ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_waiting_list (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  plan_id       uuid NOT NULL REFERENCES ad_subscription_plans(id),
  ad_type       text NOT NULL,
  region        text NOT NULL,
  status        text NOT NULL DEFAULT 'waiting'
                CHECK (status IN ('waiting','notified','converted','expired')),
  notified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_waiting_list_status_idx ON ad_waiting_list(status, ad_type, region);

-- ── 6. Ad Slot Config (per-region overrides) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_slot_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_type     text NOT NULL,
  region      text NOT NULL,
  max_slots   int  NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_type, region)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE advertisers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_waiting_list      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_slot_config       ENABLE ROW LEVEL SECURITY;

-- advertisers: owner + admin
CREATE POLICY "adv_see_own"    ON advertisers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "adv_update_own" ON advertisers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "adv_insert"     ON advertisers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "adv_admin_all"  ON advertisers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));

-- plans: anyone reads; admin writes
CREATE POLICY "plans_public_read"  ON ad_subscription_plans FOR SELECT USING (true);
CREATE POLICY "plans_admin_manage" ON ad_subscription_plans FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- campaigns: owner reads own; public reads active; admin sees all
CREATE POLICY "camp_own_select"    ON ad_campaigns FOR SELECT
  USING (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid()));
CREATE POLICY "camp_own_insert"    ON ad_campaigns FOR INSERT
  WITH CHECK (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid()));
CREATE POLICY "camp_public_active" ON ad_campaigns FOR SELECT
  USING (status = 'active' AND payment_status = 'completed'
         AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "camp_admin_all"     ON ad_campaigns FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));

-- payments: owner reads own; admin sees all
CREATE POLICY "pay_own_select" ON ad_payments FOR SELECT
  USING (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid()));
CREATE POLICY "pay_own_insert" ON ad_payments FOR INSERT
  WITH CHECK (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid()));
CREATE POLICY "pay_admin_all"  ON ad_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));

-- waiting list: owner + admin
CREATE POLICY "wait_own"       ON ad_waiting_list FOR ALL
  USING (advertiser_id IN (SELECT id FROM advertisers WHERE user_id = auth.uid()));
CREATE POLICY "wait_admin_all" ON ad_waiting_list FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','staff')));

-- slot config: public read; admin write
CREATE POLICY "slot_read"         ON ad_slot_config FOR SELECT USING (true);
CREATE POLICY "slot_admin_manage" ON ad_slot_config FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ══════════════════════════════════════════════════════════════════════════════
-- Seed: Default Plans
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO ad_subscription_plans
  (name, ad_type, description, duration_days, price_tzs, slot_limit, features, display_order, is_active)
VALUES
  (
    'Banner — Wiki 1', 'banner',
    'Tangazo kubwa juu ya ukurasa wa nyumba kwa wiki moja.',
    7, 50000, 1,
    '["Nafasi #1 juu ya Home Feed","Inayoonekana na wageni wote","Picha kubwa inayovutia"]'::jsonb,
    1, true
  ),
  (
    'Banner — Mwezi 1', 'banner',
    'Tangazo kubwa juu ya ukurasa wa nyumba kwa mwezi mzima.',
    30, 150000, 1,
    '["Nafasi #1 juu ya Home Feed","Inayoonekana na wageni wote","Picha kubwa inayovutia","Thamani kubwa kwa bei nafuu"]'::jsonb,
    2, true
  ),
  (
    'Search Ad — Wiki 1', 'search',
    'Tangazo lako linaonekana kwenye matokeo ya utafutaji kwa wiki moja.',
    7, 35000, 2,
    '["Inakaa juu ya matokeo ya utafutaji","Lebo Iliyodhaminiwa","Inafika wateja wanaotafuta"]'::jsonb,
    3, true
  ),
  (
    'Search Ad — Mwezi 1', 'search',
    'Tangazo lako linaonekana kwenye matokeo ya utafutaji kwa mwezi mzima.',
    30, 100000, 2,
    '["Inakaa juu ya matokeo ya utafutaji","Lebo Iliyodhaminiwa","Inafika wateja wanaotafuta"]'::jsonb,
    4, true
  ),
  (
    'Nearby Ad — Wiki 1', 'nearby',
    'Fikia wateja wanaotazama nyumba karibu na eneo lako.',
    7, 25000, 5,
    '["Inaonekana ndani ya ukurasa wa listing","Inafika wateja wenye nia ya kukaa"]'::jsonb,
    5, true
  ),
  (
    'Nearby Ad — Mwezi 1', 'nearby',
    'Fikia wateja wanaotazama nyumba karibu na eneo lako kwa mwezi.',
    30, 70000, 5,
    '["Inaonekana ndani ya ukurasa wa listing","Inafika wateja wenye nia ya kukaa"]'::jsonb,
    6, true
  ),
  (
    'Video Ad — Wiki 1', 'video',
    'Onyesha video ya biashara yako ndani ya feed ya nyumba.',
    7, 45000, 3,
    '["Video yako ndani ya feed ya nyumba","Inaonekana baada ya listings 6–8","Athari kubwa ya uangalizi"]'::jsonb,
    7, true
  ),
  (
    'Video Ad — Mwezi 1', 'video',
    'Onyesha video ya biashara yako ndani ya feed ya nyumba kwa mwezi mzima.',
    30, 120000, 3,
    '["Video yako ndani ya feed ya nyumba","Inaonekana baada ya listings 6–8","Athari kubwa ya uangalizi"]'::jsonb,
    8, true
  ),
  (
    'Featured Business — Mwezi 1', 'featured',
    'Orodhesha biashara yako kwenye directory ya mji wako kwa mwezi mmoja.',
    30, 80000, 10,
    '["Unakuwa kwenye directory ya mji wako","Inaonekana na watu wa eneo lako","Picha, maelezo, na kitufe cha WhatsApp"]'::jsonb,
    9, true
  ),
  (
    'Featured Business — Miezi 3', 'featured',
    'Orodhesha biashara yako kwenye directory ya mji wako kwa miezi mitatu.',
    90, 200000, 10,
    '["Unakuwa kwenye directory ya mji wako","Inaonekana na watu wa eneo lako","Picha, maelezo, na kitufe cha WhatsApp","Akiba ya 17%"]'::jsonb,
    10, true
  )
ON CONFLICT DO NOTHING;
