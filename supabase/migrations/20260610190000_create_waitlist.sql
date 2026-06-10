-- Create waitlist table
create table public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.waitlist enable row level security;

-- Allow anyone to insert into the waitlist
create policy "Allow public inserts" on public.waitlist
  for insert
  with check (true);

-- Allow authenticated users (or nobody) to read the waitlist (for admin purposes, let's allow authenticated)
create policy "Allow authenticated read access" on public.waitlist
  for select
  to authenticated
  using (true);
