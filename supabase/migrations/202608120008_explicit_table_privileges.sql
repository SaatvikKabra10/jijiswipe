-- Make Data API privileges reproducible on fresh projects. RLS still scopes every row.
revoke all on table public.profiles from anon;
revoke all on table public.clothing_items from anon;
revoke all on table public.outfits from anon;
revoke all on table public.outfit_items from anon;
revoke all on table public.outfit_shares from anon;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.clothing_items to authenticated;
grant select, insert, update, delete on table public.outfits to authenticated;
grant select, insert, update, delete on table public.outfit_items to authenticated;
grant select, insert, update, delete on table public.outfit_shares to authenticated;
