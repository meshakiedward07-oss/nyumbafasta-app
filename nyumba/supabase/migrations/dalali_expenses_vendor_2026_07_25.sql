-- Add vendor column to dalali_expenses (missing from initial migration)
-- Run in Supabase SQL Editor
ALTER TABLE dalali_expenses
  ADD COLUMN IF NOT EXISTS vendor TEXT;

CREATE INDEX IF NOT EXISTS idx_de_vendor ON dalali_expenses(dalali_id, vendor);
