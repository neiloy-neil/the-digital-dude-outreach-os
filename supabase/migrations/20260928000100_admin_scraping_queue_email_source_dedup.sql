-- Track whether an admin-scraper email was explicitly found in scraped data
-- vs guessed, and enforce dedup on the website column going forward.
alter table public.admin_scraping_queue
  add column if not exists email_source text;

do $$ begin
  alter table public.admin_scraping_queue
    add constraint admin_scraping_queue_email_source_check
    check (email_source is null or email_source in ('found', 'guessed'));
exception when duplicate_object then null; end $$;

-- Remove pre-existing case-insensitive duplicate websites (keep the earliest
-- row per website) so the unique index below can be created.
with ranked as (
  select id, row_number() over (partition by lower(website) order by created_at asc, id asc) as rn
  from public.admin_scraping_queue
  where website is not null
)
delete from public.admin_scraping_queue
where id in (select id from ranked where rn > 1);

create unique index if not exists idx_admin_scraping_queue_website_unique
  on public.admin_scraping_queue (lower(website))
  where website is not null;
