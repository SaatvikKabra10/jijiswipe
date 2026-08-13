-- Stable, queryable garment attributes for rules, AI recommendations, and future learning.
alter table public.clothing_items
  add column item_type text,
  add column primary_color text,
  add column secondary_color text,
  add column material text,
  add column pattern text,
  add column formality text,
  add column warmth text,
  add column seasons text[] not null default '{}',
  add column style_tags text[] not null default '{}',
  add column weather_tags text[] not null default '{}',
  add column metadata_source text not null default 'manual',
  add column metadata_version integer not null default 1,
  add column metadata_confirmed_at timestamptz,
  add column analysis_model text;

alter table public.clothing_items
  add constraint clothing_items_type_length check (item_type is null or char_length(item_type) between 1 and 40),
  add constraint clothing_items_primary_color_check check (primary_color is null or primary_color in ('black','white','gray','cream','brown','beige','red','orange','yellow','green','blue','purple','pink','metallic','multicolor')),
  add constraint clothing_items_secondary_color_check check (secondary_color is null or secondary_color in ('black','white','gray','cream','brown','beige','red','orange','yellow','green','blue','purple','pink','metallic','multicolor')),
  add constraint clothing_items_formality_check check (formality is null or formality in ('relaxed','casual','smart-casual','formal')),
  add constraint clothing_items_warmth_check check (warmth is null or warmth in ('lightweight','midweight','heavyweight')),
  add constraint clothing_items_seasons_check check (seasons <@ array['spring','summer','fall','winter']::text[]),
  add constraint clothing_items_metadata_source_check check (metadata_source in ('manual','ai','imported')),
  add constraint clothing_items_metadata_version_check check (metadata_version > 0),
  add constraint clothing_items_style_tags_size check (cardinality(style_tags) <= 12),
  add constraint clothing_items_weather_tags_size check (cardinality(weather_tags) <= 8);

create index clothing_items_owner_recommendation_idx
  on public.clothing_items (owner_id, category, formality, warmth);

comment on column public.clothing_items.metadata_source is 'Last writer of recommendation metadata; user edits always change this to manual.';
comment on column public.clothing_items.metadata_version is 'Schema/prompt version used to produce the current metadata.';
