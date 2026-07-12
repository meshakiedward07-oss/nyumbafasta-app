-- Fix: WhatsApp 'has_number' status now counts toward social_score (25 pts)
-- Previously only 'active' counted, but WhatsApp can never be 'active' via HEAD check
-- Run this in Supabase SQL Editor after the initial migration

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
    CASE WHEN NEW.facebook_status  = 'active'                     THEN 25 ELSE 0 END +
    CASE WHEN NEW.instagram_status = 'active'                     THEN 25 ELSE 0 END +
    CASE WHEN NEW.tiktok_status    = 'active'                     THEN 25 ELSE 0 END +
    CASE WHEN NEW.whatsapp_status  IN ('active', 'has_number')    THEN 25 ELSE 0 END
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

-- Re-compute quality for all existing leads so scores are correct
UPDATE leads SET updated_at = NOW();

-- Verify: count by quality
SELECT contact_quality, COUNT(*) FROM leads GROUP BY contact_quality ORDER BY contact_quality;
