-- Add is_admin column to profiles
alter table public.profiles add column if not exists is_admin boolean default false;

-- Update the waitlist_signups policy to enforce is_admin checks
drop policy if exists "Authenticated users can read waitlist signups" on public.waitlist_signups;

create policy "Admins can read waitlist signups" on public.waitlist_signups
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.is_admin = true
    )
  );
