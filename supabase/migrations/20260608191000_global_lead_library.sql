-- Global lead library and manual send support

create table if not exists public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  source text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.lead_lists enable row level security;

create policy "Users can manage own lead lists" on public.lead_lists
  for all using (auth.uid() = user_id);

alter table public.leads
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists lead_list_id uuid references public.lead_lists(id) on delete set null,
  add column if not exists is_global boolean default true,
  add column if not exists owner_type text default 'library',
  add column if not exists manual_personalization_status text default 'not_started',
  add column if not exists manual_email_subject text,
  add column if not exists manual_email_body text,
  add column if not exists manual_email_approved boolean default false,
  add column if not exists manual_email_sent_at timestamp with time zone,
  add column if not exists last_manual_email_account_id uuid references public.email_accounts(id) on delete set null,
  add column if not exists follow_up_note text,
  add column if not exists lead_owner text,
  add column if not exists deal_size numeric,
  add column if not exists pipeline_stage text default 'New';

alter table public.leads drop constraint if exists leads_campaign_id_fkey;
alter table public.leads alter column campaign_id drop not null;
alter table public.leads
  add constraint leads_campaign_id_fkey foreign key (campaign_id) references public.campaigns(id) on delete cascade;

drop policy if exists "Users can manage leads of own campaigns" on public.leads;
create policy "Users can manage library leads" on public.leads
  for all using (
    auth.uid() = user_id
    or exists (
      select 1 from public.campaigns
      where campaigns.id = leads.campaign_id
      and campaigns.user_id = auth.uid()
    )
    or exists (
      select 1 from public.lead_lists
      where lead_lists.id = leads.lead_list_id
      and lead_lists.user_id = auth.uid()
    )
  );

create table if not exists public.lead_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  status text default 'added',
  current_step integer default 0,
  next_email_at timestamp with time zone,
  last_email_sent_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (lead_id, campaign_id)
);

alter table public.lead_campaigns enable row level security;

create policy "Users can manage own lead campaign attachments" on public.lead_campaigns
  for all using (auth.uid() = user_id);

alter table public.sent_emails
  alter column campaign_id drop not null;

drop policy if exists "Users can view their sent emails" on public.sent_emails;
create policy "Users can view their sent emails" on public.sent_emails
  for select using (
    (
      sent_emails.campaign_id is not null and exists (
        select 1 from public.campaigns
        where campaigns.id = sent_emails.campaign_id
        and campaigns.user_id = auth.uid()
      )
    )
    or
    (
      sent_emails.campaign_id is null and exists (
        select 1
        from public.leads
        left join public.lead_lists on lead_lists.id = leads.lead_list_id
        where leads.id = sent_emails.lead_id
        and (
          leads.user_id = auth.uid()
          or lead_lists.user_id = auth.uid()
        )
      )
    )
  );

create index if not exists leads_lead_list_id_idx on public.leads(lead_list_id);
create index if not exists leads_is_global_idx on public.leads(is_global);
create index if not exists leads_owner_type_idx on public.leads(owner_type);
create index if not exists leads_manual_personalization_status_idx on public.leads(manual_personalization_status);
create index if not exists lead_lists_user_id_idx on public.lead_lists(user_id);
create index if not exists lead_campaigns_user_id_idx on public.lead_campaigns(user_id);
create index if not exists lead_campaigns_lead_id_idx on public.lead_campaigns(lead_id);
create index if not exists lead_campaigns_campaign_id_idx on public.lead_campaigns(campaign_id);
