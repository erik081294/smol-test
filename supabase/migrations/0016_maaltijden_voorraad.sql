-- ============================================================================
-- HUISHOEK — 0016: Slimme keuken-loop (Maaltijden + Voorraad)
-- ============================================================================
-- Twee nieuwe modules bovenop de productcatalogus (0013/0014):
--   • recipes / recipe_ingredients — recepten (MLT-2). recipe_ingredients erft de
--     zichtbaarheid van zijn parent-recipe (kind-tabel-patroon).
--   • meal_plan_entries            — het weekmenu (MLT-1).
--   • pantry_items                 — voorraad + houdbaarheid (VOO-1).
-- Alle hoofdtabellen zijn HOUSEHOLD-BREDE referentie-/toestandsdata: simpele
-- is_member-RLS (zoals products/zones), GEEN visibility-contract — een gezin deelt
-- zijn menu en voorraad. Bedragen/aantallen als numeric; geen floats voor geld
-- (geld leeft in expenses).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Recepten (household-breed, herbruikbaar in het weekmenu).
-- ---------------------------------------------------------------------------
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null,
  servings      int  not null default 2 check (servings > 0),
  instructions  text,
  photo_path    text,                       -- bucket 'recipes' (zie 0017-bucket) of hergebruik
  source_url    text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists recipes_household_idx on public.recipes(household_id);

-- ---------------------------------------------------------------------------
-- 2. Recept-ingrediënten. Koppel bij voorkeur aan een per-huishouden product
--    (product_id) of een globaal catalogusproduct (catalog_product_id); anders
--    vrije tekst (name) als terugval. Erft via de parent-recipe.
-- ---------------------------------------------------------------------------
create table if not exists public.recipe_ingredients (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  recipe_id          uuid not null references public.recipes(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  name               text not null,
  quantity           numeric not null default 1,
  unit               text default 'stuk',
  sort_order         int not null default 0
);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id);

-- ---------------------------------------------------------------------------
-- 3. Weekmenu-entries: wat eten we wanneer. recipe_id null = vrije-tekst-maaltijd.
-- ---------------------------------------------------------------------------
create table if not exists public.meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plan_date    date not null,
  meal_type    text not null default 'diner'
                 check (meal_type in ('ontbijt','lunch','diner','snack')),
  recipe_id    uuid references public.recipes(id) on delete set null,
  title        text,                         -- vrije tekst als er geen recept is
  servings     int  not null default 2 check (servings > 0),
  note         text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists meal_plan_household_date_idx on public.meal_plan_entries(household_id, plan_date);

-- ---------------------------------------------------------------------------
-- 4. Voorraad: wat is in huis + houdbaarheid + drempel "bijna op".
-- ---------------------------------------------------------------------------
create table if not exists public.pantry_items (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  name               text not null,
  quantity           numeric not null default 1,
  unit               text default 'stuk',
  location           text not null default 'kast'
                       check (location in ('koelkast','vriezer','kast','overig')),
  best_before        date,
  low_threshold      numeric,               -- null = alleen houdbaarheid bewaakt
  updated_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists pantry_household_idx on public.pantry_items(household_id);
create index if not exists pantry_bestbefore_idx on public.pantry_items(household_id, best_before);

-- ---------------------------------------------------------------------------
-- 5. RLS. recipes / meal_plan_entries / pantry_items: lid van het huishouden mag
--    alles (zoals products in 0013). recipe_ingredients: via de parent-recipe.
-- ---------------------------------------------------------------------------
alter table public.recipes            enable row level security;
alter table public.meal_plan_entries  enable row level security;
alter table public.pantry_items       enable row level security;
alter table public.recipe_ingredients enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes','meal_plan_entries','pantry_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_member', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_member(household_id)) with check (public.is_member(household_id))',
      t || '_member', t
    );
  end loop;
end $$;

drop policy if exists recipe_ingredients_member on public.recipe_ingredients;
create policy recipe_ingredients_member on public.recipe_ingredients for all
  using (exists (
    select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.household_id)
  ))
  with check (exists (
    select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.household_id)
  ));

-- ---------------------------------------------------------------------------
-- 6. Realtime (idempotent, zoals 0013 §6).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['recipes','recipe_ingredients','meal_plan_entries','pantry_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Atomair meerdere boodschappen toevoegen (weekmenu → lijst, in één keer).
--    Patroon van create_purchase (0013). p_items: jsonb-array
--    [{ name, product_id?, catalog_product_id? }]. Geeft de aangemaakte rijen terug.
-- ---------------------------------------------------------------------------
create or replace function public.add_groceries(p_household_id uuid, p_items jsonb)
returns setof public.groceries
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;
  return query
  insert into public.groceries (household_id, added_by, name, product_id, catalog_product_id)
  select p_household_id, auth.uid(), i->>'name',
         nullif(i->>'product_id','')::uuid, nullif(i->>'catalog_product_id','')::uuid
  from jsonb_array_elements(p_items) as i
  where coalesce(trim(i->>'name'), '') <> ''
  returning *;
end $$;
