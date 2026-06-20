# Plan 09 — Slimme keuken-loop (Maaltijden MLT-1/MLT-2 + Voorraad VOO-1)

**Backlog:** MLT-1 (weekmenu), MLT-2 (recepten), VOO-1 (voorraad). **Soort:** twee nieuwe
modules bovenop de bestaande productcatalogus. **Migratie:** ja (`0016`). **Afhankelijkheden:**
leunt op `products`/`catalog_products` (0013/0014) en `groceries`; geen blocker.

## Waarom

Het keuken-vliegwiel maakt de net gebouwde catalogus dagelijks waardevol:
*weekmenu → recept → boodschappenlijst (minus voorraad) → kopen → voorraad →
"bijna op"/houdbaarheid → terug naar het menu*. Twee modules: **Maaltijden** (recepten +
weekmenu) en **Voorraad** (wat is in huis + houdbaarheid).

> Bouw op de bestaande conventies (zie [`00-overzicht.md`](./00-overzicht.md) cheat-sheet):
> `useCollection` (optimistisch), `enable_module_rls`/kind-tabel-RLS, `lib/ui.js`-componenten +
> tokens, `lib/toast.js` (undo), `lib/haptics.js`, `lib/motion.js`, `lib/i18n.js` (`t()`),
> `lib/home/cards.js`. De catalogus: `lib/useProducts.js` (`suggestFor`/`matchFor`),
> `lib/useCatalog.js` (`useCatalogSearch`), `groceries.product_id`/`catalog_product_id`,
> `lib/useGroceries.js` (`add(name, productId, catalogProductId)`), `lib/productMatch.js`
> (`normalize`). Catalogus-tabellen zijn household-breed met `is_member`-RLS (zoals `products`).

## A1. Datamodel — migratie `0016_maaltijden_voorraad.sql`

Alle tabellen zijn **household-brede referentie-/toestandsdata** (zoals `products`/`zones`):
simpele `is_member`-RLS, géén `visibility`-contract — een gezin deelt menu en voorraad.
`recipe_ingredients` erft via de parent-recipe (kind-tabel-patroon).

```sql
-- 1. Recepten (household-breed, herbruikbaar in het weekmenu).
create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null,
  servings      int  not null default 2 check (servings > 0),
  instructions  text,
  photo_path    text,                       -- bucket 'recipes' (A1.b) of hergebruik 'receipts'
  source_url    text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists recipes_household_idx on public.recipes(household_id);

-- 2. Recept-ingrediënten. Koppel bij voorkeur aan een per-huishouden product
--    (product_id, voedt prijs/voorraad) of een globaal catalogusproduct
--    (catalog_product_id); anders vrije tekst (name) als terugval.
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

-- 3. Weekmenu-entries: wat eten we wanneer. recipe_id null = vrije-tekst-maaltijd.
create table if not exists public.meal_plan_entries (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  plan_date    date not null,
  meal_type    text not null default 'diner' check (meal_type in ('ontbijt','lunch','diner','snack')),
  recipe_id    uuid references public.recipes(id) on delete set null,
  title        text,                         -- vrije tekst als er geen recept is
  servings     int  not null default 2 check (servings > 0),
  note         text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists meal_plan_household_date_idx on public.meal_plan_entries(household_id, plan_date);

-- 4. Voorraad: wat is in huis + houdbaarheid + drempel "bijna op".
create table if not exists public.pantry_items (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  catalog_product_id uuid references public.catalog_products(id) on delete set null,
  name               text not null,
  quantity           numeric not null default 1,
  unit               text default 'stuk',
  location           text default 'kast' check (location in ('koelkast','vriezer','kast','overig')),
  best_before        date,
  low_threshold      numeric,               -- null = alleen houdbaarheid bewaakt
  updated_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists pantry_household_idx on public.pantry_items(household_id);
create index if not exists pantry_bestbefore_idx on public.pantry_items(household_id, best_before);

-- 5. RLS: is_member household-breed voor recipes/meal_plan_entries/pantry_items;
--    recipe_ingredients via de parent-recipe.
alter table public.recipes            enable row level security;
alter table public.meal_plan_entries  enable row level security;
alter table public.pantry_items       enable row level security;
alter table public.recipe_ingredients enable row level security;

do $$ declare t text;
begin
  foreach t in array array['recipes','meal_plan_entries','pantry_items'] loop
    execute format('drop policy if exists %I on public.%I', t||'_member', t);
    execute format('create policy %I on public.%I for all using (public.is_member(household_id)) with check (public.is_member(household_id))', t||'_member', t);
  end loop;
end $$;

drop policy if exists recipe_ingredients_member on public.recipe_ingredients;
create policy recipe_ingredients_member on public.recipe_ingredients for all
  using (exists (select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.household_id)))
  with check (exists (select 1 from public.recipes r where r.id = recipe_id and public.is_member(r.household_id)));

-- 6. Realtime (idempotent do-block zoals 0013 §6) voor de vier tabellen.

-- 7. Atomair meerdere boodschappen toevoegen (menu → lijst, in één keer).
--    p_items: jsonb [{ name, product_id?, catalog_product_id? }].
create or replace function public.add_groceries(p_household_id uuid, p_items jsonb)
returns setof public.groceries language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode='check_violation';
  end if;
  return query
  insert into public.groceries (household_id, added_by, name, product_id, catalog_product_id)
  select p_household_id, auth.uid(), i->>'name',
         nullif(i->>'product_id','')::uuid, nullif(i->>'catalog_product_id','')::uuid
  from jsonb_array_elements(p_items) as i
  returning *;
end $$;
```

**A1.b Storage (recept-foto's):** kopieer `0010_plant_photos.sql` voor een bucket `recipes`
(pad `<household_id>/<recipe_id>.<ext>`, `is_member`-policies) — of hergebruik `receipts`.
Hergebruik `lib/plantPhoto.js`-helpers (`extFromUri`, `contentTypeForExt`, `parseDataUrl`).

**Constants:** voeg `MEAL_TYPES`, `PANTRY_LOCATIONS`, `UNITS` toe aan `lib/constants.js`;
breid `tests/constants-sync.test.js` uit (zelfde mechaniek als `CATEGORIES` ↔ CHECK).

## A2. Pure logica (volledig getest, geen React/Supabase)

**`lib/mealPlan.js`**
```js
import { startOfWeek, addDays, format } from 'date-fns';
export function weekRange(date = new Date()) { /* startOfWeek weekStartsOn:1 -> {start, days:[7×'yyyy-MM-dd']} */ }
export function groupByDate(entries) { /* { 'yyyy-MM-dd': [entry…] }, gesorteerd op meal_type-volgorde */ }
// entries:[{recipe_id,servings}] + recipesById -> [{key,name,productId,catalogProductId,unit,quantity}]
// key = product_id ?? catalog_product_id ?? normalize(name); schaal = entry.servings/recipe.servings; zelfde unit telt op.
export function aggregateIngredients(entries, recipesById) { /* … */ }
```
Units (`tests/mealPlan.test.js`): weekRange ma-start + 7 dagen; groupByDate-sortering;
aggregateIngredients telt zelfde product op, schaalt op servings, houdt units gescheiden,
bucket vrije tekst op `normalize(name)`.

**`lib/pantry.js`**
```js
import { differenceInCalendarDays, parseISO } from 'date-fns';
export const PANTRY_STATUS = { FRESH:'vers', LOW:'bijna-op', SOON:'binnenkort', EXPIRED:'verlopen' };
export function status(item, { now = new Date(), soonDays = 3 } = {}) { /* verlopen>bijna-op>binnenkort>vers */ }
export function daysUntil(bestBefore, now = new Date()) { /* int | null */ }
export function shoppingGap(needed, pantryItems) { /* behoefte − voorraad per key+unit, >0 */ }
export function sortByUrgency(items, opts) { /* verlopen, binnenkort, bijna-op, vers (stabiel) */ }
```
Units (`tests/pantry.test.js`): status-grenzen (vandaag = nog niet verlopen); shoppingGap
trekt af + laat niets-nodig weg + units gescheiden; sortByUrgency-volgorde.

## A3. Hooks
- **`lib/useRecipes.js`** — `useCollection('recipes', { order:[{column:'title'}] })` + detail-
  loader (patroon `useExpenses`) met embedded `recipe_ingredients(*)` + realtime; acties
  `addRecipe/updateRecipe/removeRecipe/addIngredient/updateIngredient/removeIngredient`.
- **`lib/useMealPlan.js`** — laadt `meal_plan_entries` voor een weekvenster (`weekRange`) +
  realtime; `addEntry/updateEntry/removeEntry`; `buildShoppingList(entries, recipesById,
  pantry)` = `aggregateIngredients` → `shoppingGap`; `commitShoppingList(items)` →
  `supabase.rpc('add_groceries', …)`; geeft toegevoegde namen terug (undo-toast).
- **`lib/usePantry.js`** — `useCollection('pantry_items')`; `adjustQuantity(id, delta)`,
  `consumeRecipe(recipe, servings)`, `restockFromPurchase(purchaseItems)`; status via `lib/pantry.js`.

## A4. Modules & navigatie
- `lib/modules.js`: `{ key:'maaltijden', label:'Maaltijden', icon:'meals', route:'maaltijden',
  kind:'data', table:'meal_plan_entries', creatorColumn:'created_by', core:false, primary:false }`
  en `{ key:'voorraad', label:'Voorraad', icon:'pantry', route:'voorraad', kind:'data',
  table:'pantry_items', creatorColumn:'updated_by', core:false, primary:false }`.
- `lib/icons.js`: voeg `meals` (Phosphor `ForkKnife`/`CookingPot`) en `pantry`
  (`Basket`/`Fridge`) toe — verifieer exacte exportnamen.
- `lib/illustrations.js`: `meals` + `pantry` (volg `.claude/skills/svg-illustraties`-beeldtaal).

## A5. Schermen (alles uit `lib/ui.js` + tokens; DESIGN.md-principes)

**`app/(tabs)/maaltijden.js` — weekmenu.** `ScreenHeader` ("Wat eten we deze week"); een
weekstrip van 7 dag-`Chip`s (vandaag gemarkeerd) → per dag een `Card` met geplande maaltijden
als `ItemRow` (recept/vrije tekst · `Badge` meal_type · servings · chevron). Lege slot tik →
entry toevoegen (recept zoeken in `useRecipes`, of vrije tekst + `meal_type`-`Chip`s +
servings-`Stepper`); optimistic met `animateNextLayout`. Primaire actie "Boodschappen
aanvullen" → `buildShoppingList` → bottom-sheet preview (patroon `ChoreLibrarySheet`, toont
"−X in voorraad") → `commitShoppingList` → `useToast` met "Ongedaan maken" + `success()`.
`Empty illustration="meals"`.

**`app/recipe/[id].js` (+ `_layout.js`).** `ModalHeader`; titel (`Field`), servings
(`Stepper`), foto (patroon uit `app/plant/[id].js`), `source_url`, instructies (multiline
`Field`). Ingrediënten als `ItemRow`-lijst; toevoegen via naam-`Field` + autocomplete
(`useProducts.suggestFor`/`useCatalogSearch`) → `product_id`/`catalog_product_id` + quantity +
unit-`Chip`s. Inline validatie via `Field` `error` (geen blokkerende `Alert`).

**`app/(tabs)/voorraad.js`.** `ScreenHeader` + `Banner` (warning/danger) bij verlopen/
binnenkort. Lijst per `location` (`SectionHeader`) of `Chip`-filter "Op urgentie"
(`sortByUrgency`); `ItemRow`: naam · qty/unit · houdbaarheids-`Badge` (tone via `status`) ·
"+1/−1" + "op de lijst" (→ `useGroceries.add` + undo-toast). `FAB` toevoegen (naam +
catalogus-autocomplete + locatie-`Chip`s + houdbaarheid via datum-stepper + drempel).
`Empty illustration="pantry"`; `ListSkeleton` tijdens load.

## A6. Integratie
- `app/purchase/[id].js`: actie "Naar voorraad" → `usePantry.restockFromPurchase(items)`.
- Thuis-dashboard (`lib/home/cards.js` + `SummaryCard`): kaart "Vanavond eten: <recept>"
  (meal_plan_entries van vandaag) + kaart "X bijna op / over de datum" (`pantry.status`).

## A7. Tests, edge cases, acceptatie
- **Units**: `tests/mealPlan.test.js`, `tests/pantry.test.js`. **RLS-integratie**:
  `recipe_ingredients` erft `recipes`; niet-lid ziet geen `meal_plan_entries`/`pantry_items`.
- **Edge cases**: ingrediënt zonder product → match op `normalize(name)`; servings-breuken
  (afronden in UI, niet in data); zelfde product andere unit → apart; `low_threshold` null →
  alleen houdbaarheid; bron verwijderd → `on delete set null`, valt terug op vrije tekst.
- **Acceptatie**: week met 3 recepten → "Boodschappen aanvullen" zet exact de ontbrekende
  ingrediënten (minus voorraad) op de lijst (met undo); voorraad toont houdbaarheidsstatussen
  + "op de lijst"; Thuis toont "vanavond eten" + "bijna op". `npm test` groen.

## A8. File-checklist
**Nieuw:** `supabase/migrations/0016_maaltijden_voorraad.sql` (+ evt. recipes-bucket) ·
`lib/mealPlan.js` · `lib/pantry.js` · `lib/useRecipes.js` · `lib/useMealPlan.js` ·
`lib/usePantry.js` · `app/(tabs)/maaltijden.js` · `app/(tabs)/voorraad.js` ·
`app/recipe/[id].js` + `_layout.js` · `tests/mealPlan.test.js` · `tests/pantry.test.js`
**Gewijzigd:** `lib/modules.js` · `lib/icons.js` · `lib/illustrations.js` · `lib/constants.js`
· `tests/constants-sync.test.js` · `lib/i18n.js` (`meals.*`/`pantry.*`) · `lib/home/cards.js`
· `app/purchase/[id].js` · `tests/rls.integration.test.js` · `huishoek-backlog.md` ·
`docs/plans/00-overzicht.md`.
