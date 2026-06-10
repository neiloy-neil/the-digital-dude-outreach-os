CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  sender_email text not null,
  recipient_email text not null,
  subject text not null,
  snippet text,
  body_text text,
  body_html text,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived', 'replied')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.inbox_messages enable row level security;

DROP POLICY IF EXISTS "Users can view their own inbox messages" ON public.inbox_messages;
create policy "Users can view their own inbox messages"
  on public.inbox_messages for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own inbox messages" ON public.inbox_messages;
create policy "Users can insert their own inbox messages"
  on public.inbox_messages for insert
  with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own inbox messages" ON public.inbox_messages;
create policy "Users can update their own inbox messages"
  on public.inbox_messages for update
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own inbox messages" ON public.inbox_messages;
create policy "Users can delete their own inbox messages"
  on public.inbox_messages for delete
  using (auth.uid() = user_id);
