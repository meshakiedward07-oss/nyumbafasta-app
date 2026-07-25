-- Fix emails table: expand status constraint to include all delivery states
-- Run in Supabase SQL Editor

ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_status_check;

ALTER TABLE emails
  ADD CONSTRAINT emails_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'received', 'delivered', 'bounced', 'complained'));
