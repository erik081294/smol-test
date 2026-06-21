-- ============================================================================
-- HUISHOEK — 0014: Globale productcatalogus uit Open Food Facts (NL)
-- ============================================================================
-- Een GEDEELDE referentiecatalogus om de boodschappenlijst mee te vullen: de
-- gebruiker bladert door categorieën of zoekt, en tikt een product aan. De data
-- komt uit de Nederlandse subset van Open Food Facts (ODbL-licentie) en wordt
-- door scripts/import-off-dump.mjs gevuld via de service-role (OFF data-dump).
--
-- Anders dan de boodschappen-tabellen uit 0013 is dit NIET huishouden-gescopet:
--   • catalog_products    — globale producten (EAN, naam, merk, categorie, foto).
--   • catalog_categories  — onze eigen "schap"-taxonomie (Nederlandse rubrieken).
-- RLS = alleen-lezen voor ingelogde gebruikers; schrijven gaat enkel via de
-- service-role (die RLS omzeilt) vanuit het importscript. Geen realtime: dit is
-- statische referentiedata, geen huishouden-stroom.
--
-- `groceries` krijgt een tweede, optionele koppelkolom naar dit catalogusproduct
-- (naast de bestaande product_id naar de per-huishouden `products` uit 0013).
-- ============================================================================

-- Trigram-zoeken (typo-tolerant + substring via GIN-index). In public zodat de
-- operators/opclass altijd op het search_path staan (geen extensions-schema-gedoe).
create extension if not exists pg_trgm with schema public;

-- ---------------------------------------------------------------------------
-- 1. Onze curated categorie-taxonomie ("schappen"). `key` is de stabiele sleutel
--    die catalog_products.category en het importscript (lib/offCategoryMap.js)
--    gebruiken; `emoji` + `label` zijn voor de UI (categorie wordt áltijd met
--    label getoond, niet met kleur/emoji alleen).
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_categories (
  key    text primary key,
  label  text not null,
  emoji  text,
  sort   int  not null default 100
);

insert into public.catalog_categories (key, label, emoji, sort) values
  ('groente-fruit',     'Groente & fruit',        '🥦', 10),
  ('zuivel',            'Zuivel & eieren',        '🥛', 20),
  ('kaas-vleeswaren',   'Kaas & vleeswaren',      '🧀', 30),
  ('vlees-vis',         'Vlees & vis',            '🥩', 40),
  ('brood',             'Brood & bakkerij',       '🍞', 50),
  ('ontbijt-beleg',     'Ontbijt & beleg',        '🥣', 60),
  ('pasta-rijst',       'Pasta, rijst & wereld',  '🍝', 70),
  ('conserven',         'Conserven & soep',       '🥫', 80),
  ('sauzen-kruiden',    'Sauzen & kruiden',       '🧂', 90),
  ('snoep-snacks',      'Snoep & snacks',         '🍫', 100),
  ('koek-gebak',        'Koek & gebak',           '🍪', 110),
  ('dranken',           'Dranken',                '🧃', 120),
  ('diepvries',         'Diepvries',              '🧊', 130),
  ('baby',              'Baby & kind',            '🍼', 140),
  ('verzorging',        'Verzorging & drogist',   '🧴', 150),
  ('huishouden',        'Huishouden & non-food',  '🧽', 160),
  ('dieren',            'Huisdieren',             '🐾', 170),
  ('overig',            'Overig',                 '🛒', 999)
on conflict (key) do update
  set label = excluded.label, emoji = excluded.emoji, sort = excluded.sort;

-- ---------------------------------------------------------------------------
-- 2. De globale catalogus. `code` is de EAN/barcode (uniek). `search` is de
--    genormaliseerde naam (lib/productMatch.normalize, in JS gespiegeld door het
--    importscript) waarop we trigram-zoeken. `image_url` is een hotlink naar de
--    OFF-CDN (CC-BY-SA — niet rehosten; attributie staat in de UI).
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_products (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  brands      text,
  quantity    text,
  image_url   text,
  category    text not null default 'overig',
  off_categories text,
  lang        text,
  search      text not null default '',
  updated_at  timestamptz not null default now()
);

-- Bladeren per categorie (alfabetisch); zoeken via trigram (GIN).
create index if not exists catalog_products_category_idx on public.catalog_products (category, name);
create index if not exists catalog_products_search_trgm_idx on public.catalog_products using gin (search gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Zoek-RPC. De client normaliseert de zoekterm (zelfde productMatch.normalize)
--    en geeft die als p_query mee; wij matchen op de genormaliseerde `search`
--    (substring óf trigram) en rangschikken op overeenkomst, dan naam. Lege query
--    + categorie = blader-modus (alfabetisch). Read-only, leunt op de RLS hieronder.
-- ---------------------------------------------------------------------------
create or replace function public.search_catalog(
  p_query    text default '',
  p_category text default null,
  p_limit    int  default 30,
  p_offset   int  default 0
) returns setof public.catalog_products
language sql stable
as $$
  select c.*
  from public.catalog_products c
  where (p_category is null or p_category = '' or c.category = p_category)
    and (
      coalesce(p_query, '') = ''
      or c.search ilike '%' || p_query || '%'
      or c.search % p_query
    )
  order by similarity(c.search, coalesce(p_query, '')) desc, c.name asc
  limit  least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS. Beide tabellen: alleen-lezen voor ingelogde gebruikers. Er zijn géén
--    insert/update/delete-policies → schrijven kan alléén via de service-role
--    (die RLS omzeilt) in het importscript.
-- ---------------------------------------------------------------------------
alter table public.catalog_categories enable row level security;
alter table public.catalog_products   enable row level security;

drop policy if exists catalog_categories_read on public.catalog_categories;
create policy catalog_categories_read on public.catalog_categories
  for select to authenticated using (true);

drop policy if exists catalog_products_read on public.catalog_products;
create policy catalog_products_read on public.catalog_products
  for select to authenticated using (true);

grant execute on function public.search_catalog(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Koppel een boodschap optioneel aan een catalogusproduct (toevoegen vanuit
--    bladeren). Product verwijderen ontkoppelt de boodschap (set null).
-- ---------------------------------------------------------------------------
alter table public.groceries add column if not exists catalog_product_id uuid
  references public.catalog_products(id) on delete set null;
