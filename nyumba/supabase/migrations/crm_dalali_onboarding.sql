-- CRM: Specialize agent_leads for dalali onboarding tracking
-- Run manually in Supabase SQL Editor

-- 1. Add new columns to agent_leads
ALTER TABLE agent_leads
  ADD COLUMN IF NOT EXISTS converted_to_profile_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS converted_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_listing_id         UUID REFERENCES listings(id),
  ADD COLUMN IF NOT EXISTS first_listing_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_attempts         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_followup_at         TIMESTAMPTZ;

-- 2. Migrate existing pipeline_stage values to new Kiswahili stages
UPDATE agent_leads SET pipeline_stage = 'mpya'           WHERE pipeline_stage = 'new'       OR pipeline_stage IS NULL;
UPDATE agent_leads SET pipeline_stage = 'mawasiliano'    WHERE pipeline_stage = 'contacted' OR pipeline_stage = 'interested';
UPDATE agent_leads SET pipeline_stage = 'anajisajili'    WHERE pipeline_stage = 'documents';
UPDATE agent_leads SET pipeline_stage = 'amefanikiwa'    WHERE pipeline_stage = 'registered' OR pipeline_stage = 'closed';
UPDATE agent_leads SET pipeline_stage = 'amepotea'       WHERE pipeline_stage = 'lost';

-- 3. Trigger: auto-link lead when dalali registers (phone match)
CREATE OR REPLACE FUNCTION link_lead_on_registration()
RETURNS TRIGGER AS $$
DECLARE
  matching_lead UUID;
BEGIN
  -- Only fire for new dalali profiles
  IF NEW.role = 'dalali' AND NEW.phone IS NOT NULL THEN
    SELECT id INTO matching_lead
    FROM agent_leads
    WHERE phone = NEW.phone
      AND pipeline_stage NOT IN ('amefanikiwa', 'amepotea')
      AND converted_to_profile_id IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF matching_lead IS NOT NULL THEN
      UPDATE agent_leads SET
        converted_to_profile_id = NEW.id,
        converted_at            = NOW(),
        pipeline_stage          = 'anajisajili',
        updated_at              = NOW()
      WHERE id = matching_lead;

      INSERT INTO lead_communications (lead_id, type, direction, content)
      VALUES (matching_lead, 'note', 'internal',
              'Amejisajili kwenye NyumbaFasta — akaunti imeunganishwa otomatiki');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_link_lead_on_registration ON users;
CREATE TRIGGER trg_link_lead_on_registration
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION link_lead_on_registration();

-- 4. Trigger: auto-detect first listing posted
CREATE OR REPLACE FUNCTION detect_first_listing()
RETURNS TRIGGER AS $$
DECLARE
  matching_lead UUID;
BEGIN
  SELECT id INTO matching_lead
  FROM agent_leads
  WHERE converted_to_profile_id = NEW.dalali_id
    AND first_listing_id IS NULL
  LIMIT 1;

  IF matching_lead IS NOT NULL THEN
    UPDATE agent_leads SET
      first_listing_id  = NEW.id,
      first_listing_at  = NOW(),
      pipeline_stage    = 'ameweka_listing',
      updated_at        = NOW()
    WHERE id = matching_lead;

    INSERT INTO lead_communications (lead_id, type, direction, content)
    VALUES (matching_lead, 'note', 'internal',
            'Ameweka listing yake ya kwanza — ' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_detect_first_listing ON listings;
CREATE TRIGGER trg_detect_first_listing
  AFTER INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION detect_first_listing();

-- 5. Trigger: increment contact_attempts when a contact activity is logged
CREATE OR REPLACE FUNCTION increment_contact_attempts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('call', 'whatsapp', 'sms') THEN
    UPDATE agent_leads SET
      last_contacted_at = NOW(),
      contact_attempts  = COALESCE(contact_attempts, 0) + 1,
      updated_at        = NOW()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_contact_attempts ON lead_communications;
CREATE TRIGGER trg_increment_contact_attempts
  AFTER INSERT ON lead_communications
  FOR EACH ROW
  EXECUTE FUNCTION increment_contact_attempts();
