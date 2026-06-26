-- CRM missing tables: ai_recommendations + whatsapp_templates
-- Run manually in Supabase SQL Editor

-- ── AI Recommendations ─────────────────────────────────────────────────────
-- Referenced in /api/v1/crm/ai-recommend/route.ts but never created

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES agent_leads(id) ON DELETE CASCADE,
  recommendation  text NOT NULL,
  action          text NOT NULL,   -- call|whatsapp|viewing|send_photos|close_deal|nurture
  priority        integer NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  reasoning       text,
  best_time       text,            -- asubuhi|mchana|jioni
  message_hint    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_lead_id
  ON ai_recommendations (lead_id);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin staff can read ai_recommendations"
  ON ai_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Admin staff can insert ai_recommendations"
  ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

-- ── WhatsApp Templates ─────────────────────────────────────────────────────
-- Referenced in admin/crm/templates/TemplatesClient.tsx but never created

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL DEFAULT 'general',
  message     text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category
  ON whatsapp_templates (category)
  WHERE is_active = true;

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin staff can manage whatsapp_templates"
  ON whatsapp_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'staff')
    )
  );

-- Seed with a few starter templates
INSERT INTO whatsapp_templates (name, category, message) VALUES
  ('Salamu ya Kwanza',   'greeting',  'Habari {jina}! Mimi ni {dalali} kutoka NyumbaFasta. Nimekuona unatafuta nyumba {mkoa}. Ninaweza kukusaidia!'),
  ('Follow-up Baada ya Muda', 'followup', 'Habari {jina}! Nilikupigia simu wiki iliyopita. Je, bado unatafuta nyumba? Nina listings mpya za {mkoa}.'),
  ('Tarehe ya Kuona Nyumba', 'viewing', 'Habari {jina}! Viewing imepangwa {tarehe}. Tafadhali niambie kama utaweza kuja. Asante!'),
  ('Kufunga Mkataba',    'closing',   'Hongera {jina}! Nyumba ipo tayari. Lini unaweza kuja kusaini? Nitakusubiri {tarehe}.'),
  ('Kumbushio',          'reminder',  'Habari {jina}! Hii ni kumbushio tu — viewing yetu ni {tarehe}. Asante, {dalali}.')
ON CONFLICT DO NOTHING;
