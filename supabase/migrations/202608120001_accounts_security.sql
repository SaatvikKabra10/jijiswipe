-- JijiSwipe account/profile foundation. Apply through the Supabase CLI.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'JijiSwipe user'), 40)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clothing', 'clothing', false, 614400, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "clothing_read_own" on storage.objects
  for select to authenticated using (
    bucket_id = 'clothing' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "clothing_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'clothing' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "clothing_update_own" on storage.objects
  for update to authenticated using (
    bucket_id = 'clothing' and (storage.foldername(name))[1] = (select auth.uid()::text)
  ) with check (
    bucket_id = 'clothing' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
create policy "clothing_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'clothing' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
