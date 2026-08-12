-- Owner-only saved outfits and their selected closet pieces.
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.outfit_items (
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  clothing_item_id uuid not null references public.clothing_items(id) on delete restrict,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  slot text not null check (slot in ('top', 'bottom', 'outerwear', 'shoes', 'accessory')),
  primary key (outfit_id, slot),
  unique (outfit_id, clothing_item_id)
);

create index outfits_owner_created_idx on public.outfits (owner_id, created_at desc);
create index outfit_items_owner_idx on public.outfit_items (owner_id);

alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

create policy "outfits_select_own" on public.outfits for select to authenticated using ((select auth.uid()) = owner_id);
create policy "outfits_insert_own" on public.outfits for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "outfits_update_own" on public.outfits for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "outfits_delete_own" on public.outfits for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "outfit_items_select_own" on public.outfit_items for select to authenticated using ((select auth.uid()) = owner_id);
create policy "outfit_items_insert_own" on public.outfit_items for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.outfits where id = outfit_id and owner_id = (select auth.uid()))
  and exists (select 1 from public.clothing_items where id = clothing_item_id and owner_id = (select auth.uid()))
);
create policy "outfit_items_update_own" on public.outfit_items for update to authenticated using ((select auth.uid()) = owner_id) with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.outfits where id = outfit_id and owner_id = (select auth.uid()))
  and exists (select 1 from public.clothing_items where id = clothing_item_id and owner_id = (select auth.uid()))
);
create policy "outfit_items_delete_own" on public.outfit_items for delete to authenticated using ((select auth.uid()) = owner_id);

create trigger outfits_set_updated_at before update on public.outfits
  for each row execute procedure public.set_updated_at();
