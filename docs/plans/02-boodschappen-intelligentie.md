# Plan 02 — Boodschappen-intelligentie

**Backlog:** BOO-5 (productcatalogus & matching, *Must*), BOO-3 (prijstracker), BOO-2
(bonnetje — trap 1: foto + handmatig bevestigen). **Soort:** feature/datalaag binnen de
bestaande Boodschappen-module. **Migratie:** ja. **Afhankelijkheden:** geen (bouwt op de
bestaande `groceries`).

## Waarom & aanpak

Dit is de ruggengraat van de "slimme" boodschappen: een **productcatalogus** per
huishouden (BOO-5) waaraan boodschappen en bonregels worden gekoppeld, een **bonnetjes-
flow** die aankoophistorie + prijsdata oplevert (BOO-2, trap 1 = handmatig invoeren met
optionele foto; OCR/AI is trap 2/3, buiten scope), en een **prijstracker** die de prijs
per product over tijd en per winkel toont (BOO-3).

Bewuste keuzes:
- **Matching is het echte werk.** Begin regelgebaseerd (normaliseren + token-overlap) met
  de gebruiker als vangnet (bevestigen/nieuw product). Geen externe API.
- **Geen nieuwe chart-library**: gebruik het al aanwezige `react-native-svg` voor een
  eenvoudige sparkline.
- **Catalogus = huishouden-referentiedata**, geen "gedeeld item": simpele `is_member`-RLS
  (zoals `zones` in 0006), niet het volledige `visibility`-contract.
- **Bedragen in hele centen** (int), conform `lib/expenses.js`.

## Datamodel — migratie `NNNN_boodschappen_catalog.sql`

```sql
-- 1. Productcatalogus per huishouden (referentiedata, household-breed).
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  search        text not null,                 -- genormaliseerd (lowercase, ontdaan van ruis)
  category      text default 'overig',
  default_unit  text default 'stuk',           -- 'stuk' | 'g' | 'kg' | 'ml' | 'l' | 'pak'
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists products_household_idx on public.products(household_id);
create index if not exists products_search_idx on public.products(household_id, search);

-- 2. Een aankoop/bon (één winkelbezoek).
create table if not exists public.purchases (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  store         text,
  purchased_on  date not null default current_date,
  total_cents   int,                            -- optioneel ingevoerd bontotaal (controle)
  photo_path    text,                           -- optioneel: bon-foto in bucket 'receipts'
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists purchases_household_idx on public.purchases(household_id, purchased_on desc);

-- 3. Bonregels. product_id mag null zijn (nog niet gematcht).
create table if not exists public.purchase_items (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  purchase_id     uuid not null references public.purchases(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,                -- ruwe regeltekst zoals ingevoerd
  quantity        numeric not null default 1,
  unit            text default 'stuk',
  unit_price_cents int,                         -- prijs per eenheid (de prijstracker-bron)
  line_total_cents int,
  created_at      timestamptz not null default now()
);
create index if not exists purchase_items_product_idx on public.purchase_items(product_id, created_at);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);

-- 4. Koppel een boodschap optioneel aan een catalogusproduct (autocomplete + "gekocht"-loop).
alter table public.groceries add column if not exists product_id uuid
  references public.products(id) on delete set null;

-- 5. RLS: alles household-breed (is_member), zoals zones (0006).
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;

-- products + purchases: lid van het huishouden mag alles.
do $$
declare t text;
begin
  foreach t in array array['products','purchases'] loop
    execute format('drop policy if exists %I on public.%I', t||'_member', t);
    execute format($p$create policy %I on public.%I for all
      using (public.is_member(household_id)) with check (public.is_member(household_id))$p$, t||'_member', t);
  end loop;
end $$;

-- purchase_items: via de parent-purchase (en household_id consistent).
drop policy if exists purchase_items_member on public.purchase_items;
create policy purchase_items_member on public.purchase_items for all
  using (exists (select 1 from public.purchases p where p.id = purchase_id and public.is_member(p.household_id)))
  with check (exists (select 1 from public.purchases p where p.id = purchase_id and public.is_member(p.household_id)));

-- Realtime.
do $$ declare t text; begin
  foreach t in array array['products','purchases','purchase_items'] loop
    if not exists (select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
```

### Atomaire bon-RPC — in dezelfde migratie
Patroon van `create_expense` (0007): purchase + items in één transactie. Items kunnen
nieuwe producten meekrijgen (al gematcht in de UI → `product_id`, of null).
```sql
create or replace function public.create_purchase(
  p_household_id uuid, p_store text, p_purchased_on date, p_total_cents int,
  p_photo_path text, p_items jsonb   -- [{product_id, name, quantity, unit, unit_price_cents, line_total_cents}]
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode='check_violation';
  end if;
  insert into public.purchases (household_id, store, purchased_on, total_cents, photo_path, created_by)
  values (p_household_id, p_store, coalesce(p_purchased_on, current_date), p_total_cents, p_photo_path, auth.uid())
  returning id into v_id;
  insert into public.purchase_items (household_id, purchase_id, product_id, name, quantity, unit, unit_price_cents, line_total_cents)
  select p_household_id, v_id, nullif(i->>'product_id','')::uuid, i->>'name',
         coalesce((i->>'quantity')::numeric,1), coalesce(i->>'unit','stuk'),
         (i->>'unit_price_cents')::int, (i->>'line_total_cents')::int
  from jsonb_array_elements(p_items) as i;
  return v_id;
end $$;
```

### (Optioneel) Storage-bucket voor bon-foto's — `NNNN_receipts_bucket.sql`
Kopieer het patroon van `0010_plant_photos.sql` exact, met `bucket_id='receipts'` en pad
`<household_id>/<purchase_id>.<ext>`. Hergebruik `lib/plantPhoto.js`-helpers (extractie/
content-type) of til ze op naar een generiek `lib/storage.js`. Foto is puur naslag (geen OCR).

## BOO-5 — Productcatalogus & matching

### Pure logica — `lib/productMatch.js` (nieuw)
```js
// Normaliseer een productnaam voor opslag/vergelijking: lowercase, diacritics weg,
// merk-/maatruis dempen (bijv. "1L", "500g", "AH") optioneel strippen, dubbele spaties weg.
export function normalize(name) { /* … -> 'halfvolle melk' */ }

// Similariteit 0..1 tussen twee genormaliseerde namen (token-overlap / Dice-coëfficiënt
// op woord-bigrams). Geen externe dep.
export function similarity(a, b) { /* … */ }

// Beste match uit de catalogus boven een drempel (default 0.6), of null.
//   products: [{ id, name, search }]
export function bestMatch(name, products, threshold = 0.6) { /* { product, score } | null */ }

// Kandidatenlijst (top N) voor een "bedoelde je…?"-suggestie.
export function suggestions(name, products, n = 3) { /* [{ product, score }] */ }
```

### Units — `tests/productMatch.test.js`
- `normalize` verwijdert diacritics/hoofdletters/dubbele spaties; "Halfvolle Melk 1L" en
  "halfvolle melk" normaliseren naar iets vergelijkbaars; `similarity` hoog voor synoniemen,
  laag voor onverwante namen; `bestMatch` respecteert de drempel; deterministische tie-break op id.

### Hook & UI
- **`lib/useProducts.js`**: `useCollection('products', { order:[{column:'name'}] })`; bij
  `create` zet de UI `search: normalize(name)`. Helper `findOrSuggest(name)` met `bestMatch`.
- **Catalogus-scherm** (`app/(tabs)/boodschappen.js` header-actie → `app/product/index`?):
  liever een lijst onder een header-`IconButton` "catalogus" die naar een eenvoudig scherm
  navigeert, of een modal-sheet (patroon `ChoreLibrarySheet`). Toon producten met categorie
  + "laatste prijs". Tik → productdetail (BOO-3).
- **Boodschap toevoegen** koppelen: in de invoer van `boodschappen.js` een autocomplete uit
  de catalogus (filter op `search`). Kies een product → `groceries.product_id` gezet en de
  naam overgenomen; of laat vrije tekst toe (geen koppeling).

## BOO-2 — Bonnetje (trap 1: handmatig + optionele foto)

### Hook — `lib/usePurchases.js`
Analoog aan `useExpenses`: laad `purchases` met embedded `purchase_items(*)`, realtime op
beide tabellen. `addPurchase({ store, purchasedOn, totalCents, photoAsset, items })`:
- upload de foto (optioneel) zoals `addPlantPhoto`, krijg `photo_path`;
- roep `create_purchase` RPC aan met de items (elk met `product_id` of null).

### UI — `app/purchase/[id].js` (+ `_layout.js` modal-stack)
"Nieuwe bon": winkel (vrije tekst/recent), datum (`DateStepper` uit `task/[id].js`),
optioneel foto (`expo-image-picker`, al in deps). Daaronder **regels**: per regel naam +
aantal + eenheid (`Stepper`/`Field`) + prijs (`parseAmountToCents`). Tijdens typen toont een
`Banner`/rij de `bestMatch`-suggestie: "Koppelen aan *Halfvolle melk*?" (bevestigen) of
"+ Nieuw product". Toon een lopend totaal en vergelijk met het ingevoerde `total_cents`
(waarschuw bij verschil). Opslaan → `addPurchase`.

> De confirm-stap is precies wat trap 2/3 (per-keten parsers / AI-extractie) later
> verbetert; de datamodellen en de matching blijven gelijk.

## BOO-3 — Prijstracker

### Pure logica — `lib/priceTrack.js` (nieuw)
```js
// items: [{ purchased_on, store, unit_price_cents }] (bonregels van één product)
export function series(items) { /* gesorteerd op datum -> [{date, store, cents}] */ }
export function latestPerStore(items) { /* { [store]: { cents, date } } */ }
export function stats(items) { /* { min, max, latest, count } in centen */ }
// Trend: % verandering laatste vs. eerste binnen `days` (of over alles). null bij <2 punten.
export function trendPct(items, days = 90, now = new Date()) { /* … */ }
```

### Units — `tests/priceTrack.test.js`
- `series` sorteert; `latestPerStore` pakt per winkel de nieuwste; `trendPct` rekent goed
  en geeft null bij te weinig data; lege input → veilige defaults.

### UI — `app/product/[id].js`
Productdetail: naam/categorie, **laatste prijs per winkel** (rijen), **stats** (min/max/
trend met ▲/▼ kleur via `colors.danger`/`success`), en een **sparkline** met
`react-native-svg` (`Polyline` over de `series`; geen as-labels nodig, houd het klein).
Eronder de losse aankopen (datum · winkel · prijs).

## Integratie-loop (klein, optioneel maar waardevol)
Op `boodschappen.js`: bij een afgevinkte boodschap met `product_id` een actie "op de bon
zetten" die 'm voorinvult in de nieuwe-bon-flow. Zo groeit de prijsdata vanzelf uit het
normale gebruik. Houd dit als laatste stap; het kernpad is catalogus → bon → prijstracker.

## Edge cases & beslissingen
- **Dubbele producten**: matching dempt dit, maar gebruikers maken toch varianten. Bied in
  de catalogus later een "samenvoegen" (product_id van items verzetten) — nu buiten scope,
  noteer als BOO-5b.
- **Eenheden**: prijs per eenheid is pas vergelijkbaar binnen dezelfde eenheid. Houd `unit`
  bij en vergelijk in de tracker alleen gelijke eenheden (of toon de eenheid expliciet).
- **Geen `visibility`**: catalogus/bonnen zijn household-breed; als je later een privé-bon
  wilt, til je `purchases` naar het visibility-contract (zoals `expenses`). Nu bewust niet.
- **Constants-sync**: `default_unit`/`unit` hebben geen DB-CHECK (vrije tekst met UI-keuze);
  wil je ze borgen, voeg dan een `UNITS`-constante + CHECK + sync-test toe.

## Acceptatiecriteria
- Een bon invoeren met 3 regels → `purchases` + 3 `purchase_items`, met matching-suggesties
  die kloppen; nieuwe producten belanden in de catalogus.
- Hetzelfde product op twee data/winkels invoeren → productdetail toont prijs per winkel,
  min/max en een trend; sparkline rendert.
- Een boodschap koppelen aan een catalogusproduct werkt; `npm test` groen incl.
  `productMatch`/`priceTrack`.

## File-checklist
**Nieuw:** `supabase/migrations/NNNN_boodschappen_catalog.sql` (+ evt.
`NNNN_receipts_bucket.sql`) · `lib/productMatch.js` · `lib/priceTrack.js` ·
`lib/useProducts.js` · `lib/usePurchases.js` · `app/product/[id].js` +
`app/product/_layout.js` · `app/purchase/[id].js` + `app/purchase/_layout.js` ·
`tests/productMatch.test.js` · `tests/priceTrack.test.js`
**Gewijzigd:** `app/(tabs)/boodschappen.js` (catalogus-actie, bon-actie, autocomplete) ·
`lib/useGroceries.js` (`product_id` meegeven) · `lib/icons.js` (catalogus/bon/prijs-iconen) ·
`tests/rls.integration.test.js` (purchase_items via parent) · `huishoek-backlog.md`
(BOO-2/3/5 status) · evt. `lib/plantPhoto.js`→`lib/storage.js` (generieke foto-helpers).
