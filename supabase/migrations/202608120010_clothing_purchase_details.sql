-- Optional ownership details enable spend and future cost-per-wear analysis.
alter table public.clothing_items
  add column brand text,
  add column purchase_price_cents integer,
  add column purchase_currency text not null default 'USD',
  add column purchased_on date;

alter table public.clothing_items
  add constraint clothing_items_brand_length check (brand is null or char_length(trim(brand)) between 1 and 60),
  add constraint clothing_items_purchase_price_check check (purchase_price_cents is null or purchase_price_cents between 0 and 100000000),
  add constraint clothing_items_purchase_currency_check check (purchase_currency in ('USD','CAD','EUR','GBP')),
  add constraint clothing_items_purchase_date_check check (purchased_on is null or purchased_on <= current_date);

comment on column public.clothing_items.purchase_price_cents is 'Exact amount paid in the smallest currency unit; null means unknown, while zero means free.';
