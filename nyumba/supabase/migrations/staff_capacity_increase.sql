-- Increase default max_leads_capacity from 20 → 500 for all staff
-- Run manually in Supabase SQL Editor

-- Update existing staff who still have the old default of 20
UPDATE users
SET max_leads_capacity = 500
WHERE role = 'staff'
  AND max_leads_capacity = 20;

-- Update column default so new staff get 500 automatically
ALTER TABLE users
  ALTER COLUMN max_leads_capacity SET DEFAULT 500;
