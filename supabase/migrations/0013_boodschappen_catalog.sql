-- ============================================================================
-- HUISHOEK — 0013: Boodschappen-intelligentie (catalogus + bonnen + prijsdata)
-- ============================================================================
-- De datalaag onder BOO-5 (productcatalogus & matching), BOO-2 (bonnetje, trap 1)
-- en BOO-3 (prijstracker). Drie tabellen + een koppelkolom op `groceries`:
--   • products        — huishouden-brede referentiecatalogus (géén visibility-
--                       contract; simpele is_member-RLS zoals `zones` in 0006).
--   • purchases       — één winkelbezoek/bon (household-breed).
--   • purchase_items  — de bonregels; erven de zichtbaarheid van hun parent-purchase.
-- Bedragen in HELE CENTEN (int), nooit floats. De matching/prijslogica leeft in
-- lib/productMatch.js + lib/priceTrack.js (getest); de DB bewaart enkel de data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Productcatalogus per huishouden (referentiedata, household-breed).
--    `search` = de genormaliseerde naam (lib/productMatch.normalize) voor matching.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  search        text not null,
  category      text default 'overig',
  default_unit  text default 'stuk',
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists products_household_idx on public.products(household_id);
create index if not exists products_search_idx on public.products(household_id, search);

-- ---------------------------------------------------------------------------
-- 2. Een aankoop/bon (één winkelbezoek). total_cents is het optioneel ingevoerde
--    bontotaal (controle); photo_path verwijst naar bucket 'receipts' (later, 0014).
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  store         text,
  purchased_on  date not null default current_date,
  total_cents   int,
  photo_path    text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists purchases_household_idx on public.purchases(household_id, purchased_on desc);

-- ---------------------------------------------------------------------------
-- 3. Bonregels. product_id mag null zijn (nog niet gematcht). unit_price_cents is
--    de bron voor de prijstracker (lib/priceTrack.js).
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_items (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households(id) on delete cascade,
  purchase_id      uuid not null references public.purchases(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  name             text not null,
  quantity         numeric not null default 1,
  unit             text default 'stuk',
  unit_price_cents int,
  line_total_cents int,
  created_at       timestamptz not null default now()
);
create index if not exists purchase_items_product_idx on public.purchase_items(product_id, created_at);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);

-- ---------------------------------------------------------------------------
-- 4. Koppel een boodschap optioneel aan een catalogusproduct (autocomplete +
--    "op de bon zetten"-loop). Product verwijderen ontkoppelt de boodschap.
-- ---------------------------------------------------------------------------
alter table public.groceries add column if not exists product_id uuid
  references public.products(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. RLS. products + purchases: lid van het huishouden mag alles (zoals zones).
--    purchase_items: via de parent-purchase.
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['products','purchases'] loop
    execute format('drop policy if exists %I on public.%I', t || '_member', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_member(household_id)) with check (public.is_member(household_id))',
      t || '_member', t
    );
  end loop;
end $$;

drop policy if exists purchase_items_member on public.purchase_items;
create policy purchase_items_member on public.purchase_items for all
  using (exists (
    select 1 from public.purchases p where p.id = purchase_id and public.is_member(p.household_id)
  ))
  with check (exists (
    select 1 from public.purchases p where p.id = purchase_id and public.is_member(p.household_id)
  ));

-- ---------------------------------------------------------------------------
-- 6. Realtime (idempotent, zoals 0006/0007).
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products','purchases','purchase_items'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Atomair aanmaken: purchase + alle items in één transactie (patroon van
--    create_expense, 0007). Items krijgen optioneel een al-gematcht product mee.
--    p_items: jsonb-array [{ product_id, name, quantity, unit, unit_price_cents, line_total_cents }].
-- ---------------------------------------------------------------------------
create or replace function public.create_purchase(
  p_household_id uuid,
  p_store        text,
  p_purchased_on date,
  p_total_cents  int,
  p_photo_path   text,
  p_items        jsonb
) returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  insert into public.purchases (household_id, store, purchased_on, total_cents, photo_path, created_by)
  values (p_household_id, p_store, coalesce(p_purchased_on, current_date), p_total_cents, p_photo_path, auth.uid())
  returning id into v_id;

  insert into public.purchase_items (household_id, purchase_id, product_id, name, quantity, unit, unit_price_cents, line_total_cents)
  select p_household_id, v_id, nullif(i->>'product_id','')::uuid, i->>'name',
         coalesce((i->>'quantity')::numeric, 1), coalesce(i->>'unit', 'stuk'),
         (i->>'unit_price_cents')::int, (i->>'line_total_cents')::int
  from jsonb_array_elements(p_items) as i;

  return v_id;
end;
$$;
