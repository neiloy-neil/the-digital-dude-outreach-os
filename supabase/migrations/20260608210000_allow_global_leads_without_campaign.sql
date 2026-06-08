-- Allow library/imported leads to exist without a campaign.
-- The app already supports global lead lists with campaign_id = null.

alter table public.leads
  alter column campaign_id drop not null;
