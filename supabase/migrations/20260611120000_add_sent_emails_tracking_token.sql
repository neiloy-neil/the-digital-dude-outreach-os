-- Self-hosted open/click tracking: each outbound email gets a unique token
-- embedded in its tracking pixel and rewritten links.
alter table public.sent_emails
  add column if not exists tracking_token text;

create unique index if not exists sent_emails_tracking_token_idx
  on public.sent_emails(tracking_token)
  where tracking_token is not null;
