-- Conditional sequences: follow-up steps can require engagement with the
-- previous email (powered by self-hosted open/click tracking).
alter table public.sequences
  add column if not exists condition text not null default 'always';

do $$ begin
  alter table public.sequences
    add constraint sequences_condition_check
    check (condition in ('always', 'opened', 'not_opened', 'clicked'));
exception
  when duplicate_object then null;
end $$;

create index if not exists sequences_campaign_step_idx
  on public.sequences(campaign_id, step_number);
