-- Manual/global lead emails do not always belong to a campaign.
alter table public.sent_emails
  alter column campaign_id drop not null;
