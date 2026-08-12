-- Revocable, unguessable public outfit links. Store only a token hash.
create table public.outfit_shares (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null unique references public.outfits(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  token_hash text not null unique check (char_length(token_hash) = 64),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outfit_shares_owner_idx on public.outfit_shares (owner_id);
alter table public.outfit_shares enable row level security;

create policy "outfit_shares_select_own" on public.outfit_shares for select to authenticated using ((select auth.uid()) = owner_id);
create policy "outfit_shares_insert_own" on public.outfit_shares for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.outfits where id = outfit_id and owner_id = (select auth.uid()))
);
create policy "outfit_shares_update_own" on public.outfit_shares for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "outfit_shares_delete_own" on public.outfit_shares for delete to authenticated using ((select auth.uid()) = owner_id);

create trigger outfit_shares_set_updated_at before update on public.outfit_shares
  for each row execute procedure public.set_updated_at();
