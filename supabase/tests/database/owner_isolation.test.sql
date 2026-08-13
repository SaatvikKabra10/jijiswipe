begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'owner-one@example.com', '{"display_name":"Owner One"}'),
  ('22222222-2222-4222-8222-222222222222', 'owner-two@example.com', '{"display_name":"Owner Two"}');

insert into public.clothing_items (id, owner_id, label, category, storage_path) values
  ('11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', 'Owner one top', 'tops', '11111111-1111-4111-8111-111111111111/top.webp'),
  ('11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', 'Owner one bottom', 'bottoms', '11111111-1111-4111-8111-111111111111/bottom.webp'),
  ('22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222222', 'Owner two top', 'tops', '22222222-2222-4222-8222-222222222222/top.webp'),
  ('22222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222222', 'Owner two bottom', 'bottoms', '22222222-2222-4222-8222-222222222222/bottom.webp');

insert into public.outfits (id, owner_id, name) values
  ('11111111-1111-4111-8111-111111111110', '11111111-1111-4111-8111-111111111111', 'Owner one outfit'),
  ('22222222-2222-4222-8222-222222222220', '22222222-2222-4222-8222-222222222222', 'Owner two outfit');

insert into public.outfit_items (outfit_id, clothing_item_id, owner_id, slot) values
  ('11111111-1111-4111-8111-111111111110', '11111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111111', 'top'),
  ('11111111-1111-4111-8111-111111111110', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111111', 'bottom'),
  ('22222222-2222-4222-8222-222222222220', '22222222-2222-4222-8222-222222222201', '22222222-2222-4222-8222-222222222222', 'top'),
  ('22222222-2222-4222-8222-222222222220', '22222222-2222-4222-8222-222222222202', '22222222-2222-4222-8222-222222222222', 'bottom');

insert into public.outfit_shares (outfit_id, owner_id, token_hash) values
  ('11111111-1111-4111-8111-111111111110', '11111111-1111-4111-8111-111111111111', repeat('1', 64)),
  ('22222222-2222-4222-8222-222222222220', '22222222-2222-4222-8222-222222222222', repeat('2', 64));

select results_eq(
  $$select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('profiles','clothing_items','outfits','outfit_items','outfit_shares') and c.relrowsecurity$$,
  array[5::bigint],
  'RLS is enabled on every private public table'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select results_eq('select count(*) from profiles', array[1::bigint], 'owner one sees only their profile');
select results_eq('select count(*) from clothing_items', array[2::bigint], 'owner one sees only their clothing');
select results_eq('select count(*) from outfits', array[1::bigint], 'owner one sees only their outfits');
select results_eq('select count(*) from outfit_items', array[2::bigint], 'owner one sees only their outfit pieces');
select results_eq('select count(*) from outfit_shares', array[1::bigint], 'owner one sees only their share records');

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select results_eq('select count(*) from profiles', array[1::bigint], 'owner two sees only their profile');
select results_eq('select count(*) from clothing_items', array[2::bigint], 'owner two sees only their clothing');
select results_eq('select count(*) from outfits', array[1::bigint], 'owner two sees only their outfits');
select results_eq('select count(*) from outfit_items', array[2::bigint], 'owner two sees only their outfit pieces');
select results_eq('select count(*) from outfit_shares', array[1::bigint], 'owner two sees only their share records');
select results_eq(
  $$update clothing_items set label = 'tampered' where owner_id = '11111111-1111-4111-8111-111111111111' returning 1$$,
  $$select 1 where false$$,
  'owner two cannot update owner one clothing'
);
select results_eq(
  $$delete from outfits where owner_id = '11111111-1111-4111-8111-111111111111' returning 1$$,
  $$select 1 where false$$,
  'owner two cannot delete owner one outfits'
);
select results_eq(
  $$update clothing_items set primary_color = 'blue', formality = 'casual' where owner_id = '22222222-2222-4222-8222-222222222222' returning primary_color$$,
  array['blue'::text, 'blue'::text],
  'owner two can safely update recommendation metadata on their clothing'
);

reset role;
select ok(not has_table_privilege('anon', 'public.clothing_items', 'select'), 'anonymous visitors have no clothing table access');
select ok(not has_table_privilege('anon', 'public.outfits', 'select'), 'anonymous visitors have no outfit table access');

select * from finish();
rollback;
