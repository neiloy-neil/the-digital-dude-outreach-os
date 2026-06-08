alter table public.leads
  add column if not exists recommended_offer text;

alter table public.sent_emails
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists recipient_email text,
  add column if not exists sender_email text,
  add column if not exists sender_name text,
  add column if not exists body_html text,
  add column if not exists body_text text,
  add column if not exists email_type text default 'custom_email',
  add column if not exists step_number integer,
  add column if not exists provider_message_id text,
  add column if not exists sent_by text default 'manual',
  add column if not exists delivered_at timestamp with time zone,
  add column if not exists opened_at timestamp with time zone,
  add column if not exists clicked_at timestamp with time zone,
  add column if not exists bounced_at timestamp with time zone,
  add column if not exists replied_at timestamp with time zone,
  add column if not exists raw_provider_response jsonb default '{}'::jsonb not null;

update public.sent_emails
set
  user_id = coalesce(
    user_id,
    (
      select campaigns.user_id
      from public.campaigns
      where campaigns.id = sent_emails.campaign_id
    ),
    (
      select coalesce(leads.user_id, lead_lists.user_id)
      from public.leads
      left join public.lead_lists on lead_lists.id = leads.lead_list_id
      where leads.id = sent_emails.lead_id
    )
  ),
  recipient_email = coalesce(recipient_email, (select leads.email from public.leads where leads.id = sent_emails.lead_id)),
  provider_message_id = coalesce(provider_message_id, message_id),
  raw_provider_response = case
    when coalesce(raw_provider_response, '{}'::jsonb) = '{}'::jsonb then coalesce(metadata, '{}'::jsonb)
    else raw_provider_response
  end
where
  user_id is null
  or recipient_email is null
  or provider_message_id is null
  or coalesce(raw_provider_response, '{}'::jsonb) = '{}'::jsonb;

alter table public.sent_emails
  alter column user_id set not null,
  alter column recipient_email set not null,
  alter column sender_email drop not null,
  alter column email_type set default 'custom_email',
  alter column sent_by set default 'manual';

drop policy if exists "Users can view their sent emails" on public.sent_emails;
create policy "Users can view their sent emails" on public.sent_emails
  for select using (
    auth.uid() = user_id
    or (
      campaign_id is not null and exists (
        select 1 from public.campaigns
        where campaigns.id = sent_emails.campaign_id
        and campaigns.user_id = auth.uid()
      )
    )
    or (
      campaign_id is null and exists (
        select 1
        from public.leads
        left join public.lead_lists on lead_lists.id = leads.lead_list_id
        where leads.id = sent_emails.lead_id
        and (leads.user_id = auth.uid() or lead_lists.user_id = auth.uid())
      )
    )
  );

drop policy if exists "Users can insert their sent emails" on public.sent_emails;
create policy "Users can insert their sent emails" on public.sent_emails
  for insert with check (
    auth.uid() = user_id
    and (
      (campaign_id is not null and exists (
        select 1 from public.campaigns
        where campaigns.id = sent_emails.campaign_id
        and campaigns.user_id = auth.uid()
      ))
      or
      (campaign_id is null and exists (
        select 1
        from public.leads
        left join public.lead_lists on lead_lists.id = leads.lead_list_id
        where leads.id = sent_emails.lead_id
        and (leads.user_id = auth.uid() or lead_lists.user_id = auth.uid())
      ))
    )
  );

drop policy if exists "Users can update their sent emails" on public.sent_emails;
create policy "Users can update their sent emails" on public.sent_emails
  for update using (
    auth.uid() = user_id
  )
  with check (
    auth.uid() = user_id
  );

create index if not exists sent_emails_user_id_idx on public.sent_emails(user_id);
create index if not exists sent_emails_provider_message_id_idx on public.sent_emails(provider_message_id);
