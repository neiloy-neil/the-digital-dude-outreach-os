create table if not exists public.waitlist_signups (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    company_name text,
    role text,
    current_outreach_method text,
    use_case text,
    monthly_outreach_volume text,
    website_url text,
    agreed_to_updates boolean default false,
    source text default 'waitlist_page',
    status text default 'new',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create unique index if not exists waitlist_signups_email_unique on public.waitlist_signups (lower(email));

-- RLS Setup
alter table public.waitlist_signups enable row level security;

create policy "Public can insert waitlist signup" on public.waitlist_signups
  for insert with check (true);

create policy "Authenticated users can read waitlist signups" on public.waitlist_signups
  for select using (auth.role() = 'authenticated');
