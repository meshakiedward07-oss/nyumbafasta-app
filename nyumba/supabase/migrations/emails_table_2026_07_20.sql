-- Migration: emails table for in-app email system
-- Run manually in Supabase SQL editor

create table if not exists emails (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null default gen_random_uuid(),
  direction      text not null check (direction in ('outbound', 'inbound')),
  status         text not null check (status in ('pending', 'sent', 'failed', 'received')) default 'pending',

  -- sender
  from_email     text not null,
  from_name      text not null default '',

  -- recipient
  to_email       text not null,
  to_name        text not null default '',
  recipient_type text,
  recipient_id   text,

  -- who sent it (staff member)
  sent_by_id     uuid references auth.users(id) on delete set null,
  sent_by_name   text,

  -- content
  subject        text not null default '',
  body_text      text not null default '',

  -- Resend tracking
  resend_id      text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Index for thread lookup
create index if not exists idx_emails_thread_id   on emails(thread_id);
-- Index for inbox/sent list sorted by date
create index if not exists idx_emails_created_at  on emails(created_at desc);
-- Index for direction filter
create index if not exists idx_emails_direction   on emails(direction);
-- Index for recipient search
create index if not exists idx_emails_to_email    on emails(to_email);
create index if not exists idx_emails_from_email  on emails(from_email);
-- Index for sent-by lookup
create index if not exists idx_emails_sent_by_id  on emails(sent_by_id);

-- Auto-update updated_at
create or replace function update_emails_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists emails_updated_at on emails;
create trigger emails_updated_at
  before update on emails
  for each row execute function update_emails_updated_at();

-- RLS: Only admin/staff can read emails; inbound webhook uses service role
alter table emails enable row level security;

-- Admin and staff can read all emails
create policy "staff_read_emails" on emails
  for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.role in ('admin', 'staff')
    )
  );

-- Admin and staff can insert (sending)
create policy "staff_insert_emails" on emails
  for insert
  with check (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.role in ('admin', 'staff')
    )
  );

-- Admin and staff can update (marking sent/failed)
create policy "staff_update_emails" on emails
  for update
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()
        and u.role in ('admin', 'staff')
    )
  );
