-- Fix emails table: expand status constraint to include delivered, bounced
-- Run in Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;

-- Add expanded constraint
ALTER TABLE emails
  ADD CONSTRAINT emails_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'received', 'delivered', 'bounced'));
