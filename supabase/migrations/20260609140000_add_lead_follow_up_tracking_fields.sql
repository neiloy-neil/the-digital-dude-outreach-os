-- Add and normalize lead follow-up tracking fields for ReachMira

alter table public.leads
  add column if not exists emails_sent_count integer default 0,
  add column if not exists last_email_type text,
  add column if not exists last_contacted_at timestamp with time zone,
  add column if not exists next_follow_up_at timestamp with time zone,
  add column if not exists reply_status text default 'no_reply',
  add column if not exists next_email_at timestamp with time zone,
  add column if not exists current_step integer default 0,
  add column if not exists last_email_sent_at timestamp with time zone,
  add column if not exists manual_email_subject text,
  add column if not exists manual_email_body text,
  add column if not exists manual_email_type text,
  add column if not exists manual_email_saved_at timestamp with time zone,
  add column if not exists manual_email_approved boolean default false;

update public.leads
set
  emails_sent_count = coalesce(emails_sent_count, 0),
  current_step = coalesce(current_step, 0),
  reply_status = coalesce(reply_status, 'no_reply'),
  manual_email_approved = coalesce(manual_email_approved, false)
where emails_sent_count is null
   or current_step is null
   or reply_status is null
   or manual_email_approved is null;
