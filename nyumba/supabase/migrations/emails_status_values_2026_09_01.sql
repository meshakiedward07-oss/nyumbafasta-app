-- Migration: widen emails.status CHECK constraint to match what the
-- delivery-status webhook actually tries to set.
-- Run manually in Supabase SQL editor.
--
-- Found 2026-09-01 compose-email audit: the table shipped with
-- status in ('pending','sent','failed','received') only, but
-- app/api/v1/email/webhook/route.ts (Resend's delivery-status webhook)
-- tries to set 'delivered', 'bounced', and 'complained' whenever a real
-- email.delivered / email.bounced / email.complained / email.opened event
-- arrives. Every one of those updates was silently violating the CHECK
-- constraint and failing (the route never checked the update's error
-- before this same audit's code fix) — so no outbound email's status ever
-- progressed past 'sent' in the admin Barua Pepe UI, even after Resend
-- confirmed real delivery, a bounce, or a spam complaint.

alter table emails drop constraint if exists emails_status_check;

alter table emails add constraint emails_status_check
  check (status in ('pending', 'sent', 'delivered', 'bounced', 'complained', 'failed', 'received'));
