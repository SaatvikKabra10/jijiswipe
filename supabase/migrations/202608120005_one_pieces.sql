-- Support dresses, jumpsuits, rompers, and other one-piece garments.
alter table public.clothing_items drop constraint clothing_items_category_check;
alter table public.clothing_items add constraint clothing_items_category_check
  check (category in ('tops', 'bottoms', 'one-pieces', 'outerwear', 'shoes', 'accessories'));

alter table public.outfit_items drop constraint outfit_items_slot_check;
alter table public.outfit_items add constraint outfit_items_slot_check
  check (slot in ('top', 'bottom', 'one-piece', 'outerwear', 'shoes', 'accessory'));
