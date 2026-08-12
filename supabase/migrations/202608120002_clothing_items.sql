-- Persistent, owner-scoped closet items.
create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  label text not null check (char_length(trim(label)) between 1 and 60),
  category text not null check (category in ('tops', 'bottoms', 'outerwear', 'shoes', 'accessories')),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clothing_path_owned check (split_part(storage_path, '/', 1) = owner_id::text)
);

create index clothing_items_owner_created_idx
  on public.clothing_items (owner_id, created_at desc);

alter table public.clothing_items enable row level security;

create policy "clothing_items_select_own" on public.clothing_items
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "clothing_items_insert_own" on public.clothing_items
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "clothing_items_update_own" on public.clothing_items
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "clothing_items_delete_own" on public.clothing_items
  for delete to authenticated using ((select auth.uid()) = owner_id);

create trigger clothing_items_set_updated_at before update on public.clothing_items
  for each row execute procedure public.set_updated_at();

create or replace function public.enforce_clothing_item_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if (select count(*) from public.clothing_items where owner_id = new.owner_id) >= 250 then
    raise exception 'Closet item limit reached';
  end if;
  return new;
end;
$$;

create trigger clothing_items_limit before insert on public.clothing_items
  for each row execute procedure public.enforce_clothing_item_limit();
