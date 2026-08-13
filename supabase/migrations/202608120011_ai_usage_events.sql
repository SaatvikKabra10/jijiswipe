-- Owner-scoped metering supports hard application quotas without storing prompts or images.
create table public.ai_usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  feature text not null check (feature in ('clothing_tag','outfit_rank')),
  model text not null check (char_length(model) between 1 and 60),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_events_owner_created_idx on public.ai_usage_events (owner_id, feature, created_at desc);
alter table public.ai_usage_events enable row level security;
create policy "ai_usage_events_select_own" on public.ai_usage_events for select to authenticated using ((select auth.uid()) = owner_id);
create policy "ai_usage_events_insert_own" on public.ai_usage_events for insert to authenticated with check ((select auth.uid()) = owner_id);

revoke all on table public.ai_usage_events from anon;
grant select, insert on table public.ai_usage_events to authenticated;
grant usage, select on sequence public.ai_usage_events_id_seq to authenticated;
