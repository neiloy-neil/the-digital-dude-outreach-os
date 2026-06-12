create table if not exists public.admin_leads_pool (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  website text,
  industry text,
  location text,
  contact_name text,
  contact_title text,
  contact_email text,
  contact_linkedin text,
  company_linkedin text,
  employee_count text,
  revenue text,
  tech_stack text[],
  description text,
  tags text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.admin_leads_pool enable row level security;

-- Only admins can manage this table.
-- Assuming admins are checked via some claim or we allow read to subscribed users.
-- For now, allow read for authenticated users, we'll restrict UI to subscribed users.
create policy "Authenticated users can read admin leads pool" on public.admin_leads_pool
  for select using (auth.role() = 'authenticated');

-- We can add a policy for admin inserts if needed, or rely on service role key for API routes.
create policy "Admins can manage admin leads pool" on public.admin_leads_pool
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );

create index if not exists admin_leads_pool_industry_idx on public.admin_leads_pool(industry);
create index if not exists admin_leads_pool_location_idx on public.admin_leads_pool(location);
