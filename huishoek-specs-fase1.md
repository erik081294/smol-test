# Huishoek — Fase 1 build-ready specs

> ## ✅ Implementatiestatus (alle vier gebouwd)
> Alle vier de Fase-1 modules zijn geïmplementeerd, met groene unit-tests
> (`npm test`: pure logica volledig gedekt; RLS-integratietests skippen zonder
> Supabase-secrets). De pure kern per module zit in een los, getest bestand:
> - **Agenda** — [lib/agenda.js](lib/agenda.js) + [tests/agenda.test.js](tests/agenda.test.js) · scherm [app/(tabs)/agenda.js](app/(tabs)/agenda.js) · migratie [0005](supabase/migrations/0005_agenda.sql)
> - **Schoonmaak** — [lib/cleaningTemplates.js](lib/cleaningTemplates.js) + [tests/cleaningTemplates.test.js](tests/cleaningTemplates.test.js) · [lib/useZones.js](lib/useZones.js) · scherm [app/(tabs)/schoonmaak.js](app/(tabs)/schoonmaak.js) · migratie [0006](supabase/migrations/0006_schoonmaak.sql)
> - **Kosten** — [lib/expenses.js](lib/expenses.js) + [tests/expenses.test.js](tests/expenses.test.js) · [lib/useExpenses.js](lib/useExpenses.js) · schermen [app/(tabs)/kosten.js](app/(tabs)/kosten.js) + [app/expense/[id].js](app/expense/[id].js) · migratie [0007](supabase/migrations/0007_kosten.sql)
> - **Planten** — [lib/plantCare.js](lib/plantCare.js) + [tests/plantCare.test.js](tests/plantCare.test.js) · [lib/usePlants.js](lib/usePlants.js) · schermen [app/(tabs)/planten.js](app/(tabs)/planten.js) + [app/plant/[id].js](app/plant/[id].js) · migraties [0008](supabase/migrations/0008_planten.sql) + [0009 seed](supabase/migrations/0009_plant_species_seed.sql)
>
> **Bewuste afwijkingen van de oorspronkelijke spec hieronder:**
> 1. **Migratienummers** schoven op: er bestond al `0004_module_toggles.sql`, dus de nieuwe migraties zijn **0005–0009** (niet 0004–0008).
> 2. **Agenda zonder externe library.** I.p.v. `react-native-calendars` een eigen maandgrid met `date-fns` (`monthMatrix`) — geen nieuwe native dependency en het grid is pure, geteste logica. Het grid is altijd 6 rijen voor een stabiele layout.
> 3. **Schoonmaak hergebruikt categorie `huishouden`** (+ `zone_id`) i.p.v. een nieuwe categorie `schoonmaak`. Zo blijft `lib/constants.js` in sync met de CHECK in `0001` (de `constants-sync` test leest die als autoriteit) en is het echt DRY.
> 4. **`expense_shares` slaat alleen de berekende `amount_cents` op** (geen `weight`-kolom). Gewichten bestaan alleen in de UI op het invoermoment; de DB bewaart het resolved bedrag. De atomaire `create_expense` RPC is geïmplementeerd zoals voorgesteld.
> 5. **Plantfoto's zijn nu wél bekabeld.** Inmiddels gebouwd (na deze spec): echte upload via een private Supabase Storage-bucket + `expo-image-picker` (migratie [0010](supabase/migrations/0010_plant_photos.sql), `lib/plantPhoto.js`), plus een **plantendagboek** met meerdere foto's over tijd (migratie [0011](supabase/migrations/0011_plant_diary.sql)). De nieuwste dagboekfoto is automatisch de omslag (`plants.photo_path`). `plants.water_days` blijft de handmatige terugval als er geen soort is gekozen.
>
> **Aandachtspunt UX:** de tabbalk heeft nu 8 modules. Ze zijn allemaal toggle-baar
> (default-on) en de minder-gebruikte staan onder een **"Meer"-overflowtab** (UX-2).
> De `enable_module_rls`-aanroepen voor `expenses` en `plants` en alle RLS staan in de
> migraties en zijn **tegen live Supabase gedraaid**: de DB staat op `0011` en de
> RLS-integratietests liepen groen (zie PR #3). Resteert alleen de handmatige
> rooktest met 2 accounts in één huishouden.

---


Dit document werkt de vier Fase-1 modules uit tot **bouwbare** specificaties die
naadloos aansluiten op het bestaande framework. De volgorde is de aanbevolen
bouwvolgorde (oplopend in nieuw datamodel): **Agenda → Schoonmaak → Kosten → Planten**.

> **Status van het fundament (gecorrigeerd t.o.v. de backlog).** FND-1 (subgroepen +
> zichtbaarheid) en FND-2 (module-framework) zijn **al gebouwd**. Elke spec hieronder
> hergebruikt:
> - **Het module-contract**: een data-tabel met `household_id`, een creator-kolom, en
>   `visibility` / `share_subgroup_id` / `share_with`. Eén SQL-aanroep
>   `select public.enable_module_rls('<tabel>', '<creator_col>')` zet RLS, de vier
>   policies (via `can_view`), de subgroep-integriteitstrigger en realtime aan.
>   Zie [0003_module_framework.sql](supabase/migrations/0003_module_framework.sql).
> - **`useCollection(table, opts)`** ([useCollection.js](lib/useCollection.js)) — gescopet
>   laden + realtime + CRUD. Een module-hook (zoals [useTasks.js](lib/useTasks.js)) legt
>   alleen de module-specifieke logica erbovenop.
> - **De module-registry** ([modules.js](lib/modules.js)) — een descriptor bijzetten +
>   een scherm onder `app/(tabs)/<route>.js` maken.
> - **UI-bouwstenen** ([ui.js](lib/ui.js)): `Button`, `Field`, `Card`, `Chip`, `Avatar`,
>   `Empty`; thema via [theme.js](lib/theme.js) (`colors`, `type`, `radius`, `categoryMeta`).
> - **Zichtbaarheid in de UI**: [VisibilityPicker.js](lib/VisibilityPicker.js) +
>   `visibilityPayload()` / `validateVisibility()` uit [visibility.js](lib/visibility.js).
> - **Pure, testbare helpers** los van React/Supabase (zoals [recurrence.js](lib/recurrence.js)),
>   met `node:test` units onder `tests/`.

**Conventies die elke nieuwe module volgt**
1. Migratie krijgt het volgende nummer (huidig hoogste = `0003`, dus de eerste nieuwe is `0004`).
2. Elke nieuwe data-tabel volgt het zichtbaarheidscontract **en** krijgt de
   `<tabel>_visibility_consistent` CHECK (zie 0003 §3) plus `enable_module_rls(...)`.
3. Module-specifieke constanten (categorieën, frequenties) komen in
   [constants.js](lib/constants.js) en moeten matchen met de SQL CHECK-constraints —
   `tests/constants-sync.test.js` bewaakt dat.
4. Pure domeinlogica → eigen `lib/<module>.js` met units; data-toegang → `lib/use<Module>.js`
   bovenop `useCollection`.

---

## A. 📅 Agenda (AGE-1) — kalenderweergave met subgroep-filter

### A.1 Doel & scope
Een echte kalenderweergave bovenop de bestaande dated items. **Geen nieuwe module-tabel**:
"afspraken" bestaan al als `tasks` met `category = 'afspraak'`, en elke taak met een
`due_date` heeft een plek op de kalender. De agenda is een **weergavelaag** die filtert op
subgroep, zodat Tims voetbaltraining niet bij een ander kind verschijnt.

**In v1:** maandweergave + dag-agenda eronder; chip-filter op subgroep en op categorie;
tikken op een dag toont de items van die dag; tikken op een item opent het bestaande
`app/task/[id].js`. Een "+" op een geselecteerde dag opent `task/new` met die datum voorgevuld.

**Niet in v1:** device-agenda-sync (dat is AGE-2, Fase 3), week/dag-tijdlijn met uren,
slepen om te verzetten, meerdaagse events.

### A.2 Datamodel
Minimale, additieve uitbreiding van `tasks` (migratie `0004_agenda.sql`):

```sql
-- Optionele eindtijd, zodat een afspraak een duur kan tonen (bijv. 18:00–19:30).
alter table public.tasks add column if not exists end_time time;
-- Index voor de kalender: items van een huishouden binnen een datumvenster.
create index if not exists tasks_due_date_idx on public.tasks(household_id, due_date)
  where due_date is not null;
```

Geen RLS-wijziging nodig: `tasks` valt al onder `enable_module_rls('tasks','created_by')`,
dus subgroep-zichtbaarheid werkt automatisch — de kalender ziet exact wat de gebruiker mag zien.

### A.3 Afhankelijkheid
`react-native-calendars` toevoegen (de-facto standaard voor Expo, RN-bridge-vrij):
```
npx expo install react-native-calendars
```

### A.4 Module-registratie
Descriptor in [modules.js](lib/modules.js), als `overview` (leest `tasks`, heeft geen eigen tabel):
```js
{ key: 'agenda', label: 'Agenda', emoji: '📅', route: 'agenda', kind: 'overview', table: null },
```
Plaats hem in de tabbalk-volgorde tussen `taken` en `boodschappen` (of waar gewenst).

### A.5 Domeinlogica — `lib/agenda.js` (puur, testbaar)
```js
// Groepeert dated tasks naar { 'yyyy-MM-dd': [task, ...] } voor de kalender-markers.
export function groupByDate(tasks) { ... }

// markedDates-object voor react-native-calendars: een dot per dag met items,
// kleur volgt categoryMeta van het 'zwaarste' item (afspraak > klus > ...).
export function buildMarkedDates(tasks, selectedDate) { ... }

// Filtert op subgroep zónder server-rondje: hergebruik canView() uit visibility.js
// is niet nodig (RLS deed dat al) — dit filtert puur op "hoort dit item bij de
// gekozen subgroep-chip": item.share_subgroup_id === subgroupId, of subgroupId === null (alles).
export function filterBySubgroup(tasks, subgroupId) { ... }
```
Units in `tests/agenda.test.js`: lege lijst, items zonder `due_date` worden genegeerd,
markers per dag, subgroep-filter inclusief het "Iedereen"-geval.

### A.6 Scherm — `app/(tabs)/agenda.js`
- `SafeAreaView` + `type.h1` "Agenda" (zelfde header-patroon als [taken.js](app/(tabs)/taken.js)).
- Subgroep-chips bovenaan (uit `useHousehold().subgroups`), eerste chip "Iedereen".
- `<Calendar>` van react-native-calendars met `markedDates` uit `buildMarkedDates`, thema
  afgeleid van `colors` (forest/ocher).
- Onder de kalender een `FlatList` met de items van de geselecteerde dag (hergebruik
  [TaskRow.js](lib/TaskRow.js)), `Empty` bij geen items.
- FAB "+" → `router.push('/task/new?date=<geselecteerde dag>')`; vang de query-param in
  `task/[id].js` af om `due_date` voor te vullen.

### A.7 Edge cases
- Items zonder `due_date` verschijnen niet op de kalender (alleen in Taken). Bewust.
- Terugkerende taken tonen alleen hun **huidige** `due_date` (de volgende-instantie-logica
  rolt door bij afvinken via `nextDueDate`). Een volledige "expand naar alle toekomstige
  instanties"-weergave is expliciet buiten scope v1.
- Tijdzone: `due_date` is een `date` (geen tijdstip) → geen UTC-verschuiving; sleutels in
  `yyyy-MM-dd` lokaal formatteren met `date-fns/format`.

### A.8 Deelstappen (PR-opdeling)
1. **AGE-1a** migratie `0004` (`end_time` + index) + `lib/agenda.js` + units.
2. **AGE-1b** scherm + registry-descriptor + dependency; datum-voorvulling in `task/new`.
3. **AGE-1c** subgroep- en categorie-filter + polish (markers, thema).

---

## B. 🧹 Schoonmaak (SCH-1, SCH-2) — zonegericht rooster

### B.1 Doel & scope
Schoonmaak is **geen** nieuwe data-tabel voor de losse taken — het hergebruikt `tasks`
(categorie `huishouden`, of een nieuwe categorie `schoonmaak`). Wat het toevoegt is een
**rooster-laag**: per ruimte/zone een set terugkerende taken, en de mogelijkheid die in één
keer op te zetten vanuit een template (SCH-2). De terugkeer- en toewijzingslogica komt
ongewijzigd uit Klussen (DRY) — dit is precies waar het module-framework voor bedoeld is.

**In v1:**
- Zones (badkamer, keuken, woonkamer, ...) als lichte data-tabel per huishouden.
- Een schoonmaaktaak = gewone `tasks`-rij met `zone_id` + (meestal) een `recur_freq`.
- "Standaard weekschema opzetten" (SCH-2): kies een template → genereert in één keer
  meerdere terugkerende `tasks` met passende interval en weekdag.

**Niet in v1:** beurtverdeling + eerlijkheidsoverzicht (SCH-3, Fase 2).

### B.2 Datamodel — migratie `0005_schoonmaak.sql`
Nieuwe categorie + een `zones`-tabel + koppeling op `tasks`:

```sql
-- 1. Categorie 'schoonmaak' toevoegen aan de CHECK op tasks.category.
--    (constants.js CATEGORIES moet meegroeien — constants-sync.test bewaakt dit.)
alter table public.tasks drop constraint if exists tasks_category_check;
alter table public.tasks add constraint tasks_category_check
  check (category in ('klus','huishouden','plant','afspraak','schoonmaak','overig'));

-- 2. Zones: lichte referentie per huishouden. Volgt NIET het volledige
--    zichtbaarheidscontract (een zone is metadata, geen "item"), dus eigen,
--    simpele RLS: lid van het huishouden mag alles.
create table if not exists public.zones (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  emoji        text not null default '🧹',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists zones_household_idx on public.zones(household_id);

alter table public.zones enable row level security;
create policy zones_select on public.zones for select using (public.is_member(household_id));
create policy zones_insert on public.zones for insert with check (public.is_member(household_id));
create policy zones_update on public.zones for update using (public.is_member(household_id));
create policy zones_delete on public.zones for delete using (public.is_member(household_id));

-- 3. Koppeling op tasks (zonedelete laat de taak staan, ontkoppelt alleen).
alter table public.tasks add column if not exists zone_id uuid
  references public.zones(id) on delete set null;
```

> **Beslissing:** zones krijgen *niet* het volledige `can_view`-contract omdat ze
> structuur zijn, geen privé-items. De schoonmaaktaken zelf dragen wél de normale
> zichtbaarheid (ze zijn `tasks`-rijen), dus subgroep-scoping werkt gewoon.

### B.3 Roostersjablonen — `lib/cleaningTemplates.js` (pure data + logica)
Een vaste, regelgebaseerde set (geen AI). Elke template-regel beschrijft één terugkerende taak:

```js
// Voorbeeld-template "Standaard weekschema". Per regel: zone, titel, recurrence.
export const CLEANING_TEMPLATES = [
  {
    key: 'standaard-week',
    label: 'Standaard weekschema',
    rooms: [
      { zone: 'Badkamer',  title: 'Badkamer schoonmaken', recur_freq: 'weekly',  recur_interval: 1, recur_weekdays: [6] },
      { zone: 'Keuken',    title: 'Keuken dweilen',        recur_freq: 'weekly',  recur_interval: 1, recur_weekdays: [0] },
      { zone: 'Woonkamer', title: 'Stofzuigen',            recur_freq: 'weekly',  recur_interval: 1, recur_weekdays: [3] },
      { zone: 'Ramen',     title: 'Ramen lappen',          recur_freq: 'monthly', recur_interval: 3 },
      ...
    ],
  },
];

// Zet een template om naar (a) de benodigde zones en (b) tasks-payloads.
// Puur: krijgt bestaande zones mee, geeft terug wat aangemaakt moet worden.
export function planTemplate(template, { existingZones, householdId, startDate }) {
  // -> { zonesToCreate: [{name,emoji}], tasks: [{title, category:'schoonmaak',
  //      zone_name, due_date, recur_freq, recur_interval, recur_weekdays, visibility}] }
}
```

De `tasks` krijgen `visibility: 'household'` als default; de gebruiker kan dat per taak
later wijzigen. `due_date` = eerstvolgende passende weekdag vanaf `startDate` (hergebruik
de weekdag-zoeklogica analoog aan `nextDueDate` in [recurrence.js](lib/recurrence.js)).

Units in `tests/cleaningTemplates.test.js`: template levert het juiste aantal taken; zones
worden niet dubbel aangemaakt als ze al bestaan; weekdag → eerste `due_date` klopt.

### B.4 Data-toegang — `lib/useZones.js` + applyTemplate
```js
export function useZones() {
  // zones zijn geen 'item'-contract; useCollection volstaat tóch (household-scoped CRUD),
  // alleen zonder visibility-payload.
  const c = useCollection('zones', { label: 'zones', order: [{ column: 'sort_order' }] });
  return { zones: c.items, loading: c.loading, addZone: c.create, updateZone: c.update, removeZone: c.remove };
}
```
Het toepassen van een template combineert `useZones` (zones aanmaken) en de bestaande
`useTasks().addTask` (taken aanmaken) in een actie op het scherm — eerst ontbrekende zones
aanmaken, dan de taken met de juiste `zone_id`.

### B.5 Scherm — `app/(tabs)/schoonmaak.js`
- Header + lijst van zones (`Card` per zone) met daaronder de terugkerende schoonmaaktaken
  van die zone (uit `useTasks`, gefilterd op `category==='schoonmaak'` en `zone_id`).
- Knop **"Weekschema opzetten"** → modal met de templates uit `CLEANING_TEMPLATES`;
  preview van wat er wordt aangemaakt; bevestigen roept `planTemplate` + de inserts aan.
- FAB "+" voor een losse schoonmaaktaak (opent `task/new` met `category` voorgevuld op
  `schoonmaak` en evt. `zone_id`).
- Registry-descriptor:
  ```js
  { key: 'schoonmaak', label: 'Schoonmaak', emoji: '🧹', route: 'schoonmaak', kind: 'data', table: 'tasks', creatorColumn: 'created_by' },
  ```
  (deelt de `tasks`-tabel; `kind:'data'` met dezelfde tabel als Taken is toegestaan — de
  module-test eist alleen *een* tabel + creator-kolom, niet uniekheid van tabel.)

### B.6 Edge cases
- Template twee keer toepassen mag geen dubbele zones maken (match op naam, case-insensitive);
  taken mogen wél opnieuw worden aangemaakt → toon een waarschuwing met aantal dat al bestaat.
- Een zone verwijderen ontkoppelt de taken (`on delete set null`), verwijdert ze niet.
- De "eerlijkheid"-telling (SCH-3) is voorbereid doordat afgevinkte taken al
  `completed_by` vastleggen — geen schema-werk nodig later.

### B.7 Deelstappen
1. **SCH-1a** migratie `0005` (categorie + `zones` + `zone_id`) + `constants.js` bijwerken.
2. **SCH-1b** `useZones` + scherm met zones en losse schoonmaaktaken.
3. **SCH-2** `cleaningTemplates.js` + "weekschema opzetten"-flow + units.

---

## C. 💶 Kosten — WieBetaaltWat (KOS-1, KOS-2)

### C.1 Doel & scope
Een zelfstandige module voor gedeelde uitgaven: wie betaalde wat, wie deelt mee, en wie staat
per saldo rood/groen — met een "vereffen"-suggestie die het aantal onderlinge betalingen
minimaliseert. Subgroep-gescoped (de ouders verrekenen onderling; de kinderen zien dat niet).

**In v1:**
- Uitgave: bedrag, omschrijving, betaler, datum, deelnemers, splitsing
  (**gelijk** / **op aandeel** / **exact bedrag**).
- Saldo-overzicht per persoon binnen de gekozen subgroep-scope.
- Vereffen-suggesties (greedy schuldminimalisatie).

**Niet in v1:** koppeling aan modules (KOS-3, Fase 2), autodelen (AUT-*, Fase 2/3),
meervaluta, terugkerende uitgaven.

### C.2 Datamodel — migratie `0006_kosten.sql`
Een hoofdtabel (`expenses`, volgt het zichtbaarheidscontract) + een kindtabel met de splitsing
(`expense_shares`). Bedragen in **hele centen** (`int`) om floating-point-fouten te vermijden.

```sql
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  description   text not null,
  amount_cents  int  not null check (amount_cents > 0),
  currency      text not null default 'EUR',
  paid_by       uuid not null references public.profiles(id),
  spent_on      date not null default current_date,
  split_type    text not null default 'equal'
                  check (split_type in ('equal','shares','exact')),
  -- Zichtbaarheidscontract (identiek aan tasks/groceries):
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists expenses_household_idx on public.expenses(household_id);

-- Visibility-consistentie (zelfde patroon als 0003 §3).
alter table public.expenses add constraint expenses_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);

-- Per deelnemer een aandeel. Bij 'equal' is weight=1 voor iedereen; bij 'shares'
-- telt weight als gewicht; bij 'exact' staat het bedrag in amount_cents.
create table if not exists public.expense_shares (
  expense_id   uuid not null references public.expenses(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  weight       numeric,          -- voor 'shares' (en 'equal' = 1)
  amount_cents int,              -- voor 'exact' (en de berekende uitkomst)
  primary key (expense_id, profile_id)
);

-- Hoofdtabel via het framework afdekken (RLS + policies + realtime + trigger).
select public.enable_module_rls('expenses', 'created_by');

-- expense_shares erft de zichtbaarheid van zijn parent: RLS via een EXISTS op de
-- zichtbare expense (kan de gebruiker de expense zien, dan ook de shares).
alter table public.expense_shares enable row level security;
create policy expense_shares_select on public.expense_shares for select using (
  exists (select 1 from public.expenses e where e.id = expense_id
          and public.can_view(e.household_id, e.visibility, e.share_subgroup_id, e.share_with, e.created_by)));
create policy expense_shares_write on public.expense_shares for all using (
  exists (select 1 from public.expenses e where e.id = expense_id and public.is_member(e.household_id)))
  with check (
  exists (select 1 from public.expenses e where e.id = expense_id and public.is_member(e.household_id)));
alter publication supabase_realtime add table public.expense_shares;
```

> **Beslissing:** centen-int i.p.v. `numeric`/float. Splitsing met restcenten wordt
> deterministisch verdeeld (zie C.3) zodat de som van de aandelen **exact** het totaal is —
> nooit een verdwaalde cent.

### C.3 Domeinlogica — `lib/expenses.js` (puur, testbaar — het hart van de module)
```js
// Verdeel een bedrag over deelnemers volgens split_type. Geeft per persoon centen.
// Garandeert: som(uitkomst) === amount_cents (restcenten gaan deterministisch naar
// de eerste N deelnemers op een stabiele sortering).
export function computeShares({ amountCents, splitType, participants }) { ... }

// Saldo per persoon over een set expenses: betaald - eigen aandeel.
// Positief = krijgt nog geld; negatief = is nog geld schuldig.
export function computeBalances(expenses) { ... } // -> { profileId: cents }

// Vereffenen: minimaliseer het aantal transacties (greedy: grootste crediteur <-> grootste
// debiteur). Geeft [{ from, to, amountCents }]. Bekend, simpel en goed genoeg voor een gezin.
export function settle(balances) { ... }
```
Units in `tests/expenses.test.js`:
- `computeShares` voor elk split_type; restcent-verdeling (bijv. €10 / 3 = 334+333+333);
- saldo's tellen op tot 0;
- `settle` lost een keten op (A→B→C) in het minimale aantal betalingen;
- afronding nooit een cent kwijt of te veel.

### C.4 Data-toegang — `lib/useExpenses.js`
```js
export function useExpenses() {
  const c = useCollection('expenses', {
    label: 'uitgaven',
    order: [{ column: 'spent_on', ascending: false }],
  });
  // create overschrijven: na de expense-insert ook expense_shares schrijven
  // (in een kleine helper; idealiter een RPC/transactie zodat het atomair is).
  const addExpense = async ({ ...expenseFields, participants }) => { ... };
  return { expenses: c.items, loading: c.loading, addExpense, updateExpense: c.update, deleteExpense: c.remove };
}
```

> **Aandachtspunt — atomiciteit.** Expense + shares in twee losse inserts kan half falen.
> Aanbevolen: een Postgres-functie `create_expense(...)` (security definer) die beide in één
> transactie doet en aanroepbaar is via `supabase.rpc(...)`. Zet dit in dezelfde migratie.

### C.5 Schermen
- **`app/(tabs)/kosten.js`**: subgroep-scope-chip bovenaan; lijst van uitgaven (`Card`:
  omschrijving, bedrag, "betaald door X", datum); bovenaan een **saldo-balk** ("Jij krijgt
  €12,50" / "Jij bent €4,00 schuldig"); knop **"Vereffenen"** toont de `settle`-suggesties.
- **`app/expense/new.js`** (modal/route, net als `task/[id].js`): omschrijving, bedrag,
  betaler-picker (leden), deelnemers (multi-select leden), split-type-chips, en bij `exact`
  een bedrag-veld per deelnemer met live "nog te verdelen: €x". `VisibilityPicker` voor de scope.
- Registry-descriptor:
  ```js
  { key: 'kosten', label: 'Kosten', emoji: '💶', route: 'kosten', kind: 'data', table: 'expenses', creatorColumn: 'created_by' },
  ```

### C.6 Edge cases
- Betaler hoeft geen deelnemer te zijn (iemand betaalt voor anderen).
- `exact`-splitsing waar de som ≠ totaal → blokkeren met nette melding vóór opslaan.
- Lid verwijderd uit huishouden terwijl het in oude uitgaven zit: `profiles` blijft bestaan
  (FK `on delete` van members raakt expenses niet) — saldo blijft kloppen.
- Subgroep-scope: het saldo-overzicht rekent alleen over de **zichtbare** uitgaven (RLS doet
  de filtering al; de UI rekent over wat het binnenkrijgt).

### C.7 Deelstappen
1. **KOS-1a** migratie `0006` + `create_expense` RPC + `lib/expenses.js` + units (geen UI).
2. **KOS-1b** `useExpenses` + lijst-scherm + nieuwe-uitgave-scherm (split-types).
3. **KOS-2** saldo-balk + `settle` + "vereffenen"-weergave.

---

## D. 🪴 Planten (PLA-1 t/m PLA-4)

### D.1 Doel & scope
Een eigen module met een andere ritmiek dan klussen. De kern: een **regelgebaseerde
soortdatabase** die op basis van soort + locatie + seizoen een verzorgingsschema genereert —
en dat schema komt terug als **terugkerende `tasks`** (categorie `plant`, die al bestaat).
Zo hergebruiken we de hele recurrence- en Vandaag-infrastructuur; de plant-module voegt alleen
de plant-entiteit, de soortkennis en de verzorgingskaart toe.

**In v1:**
- **PLA-1** Plant toevoegen: foto (Supabase Storage), naam, locatie, **handmatige** soortkeuze.
- **PLA-2** Soortdatabase: enkele honderden populaire soorten met water-/voedings-/lichtregels
  (read-only referentie, niet per huishouden).
- **PLA-3** Verzorgingsschema op maat → genereert terugkerende water-/voedingstaken.
- **PLA-4** Verzorgingskaart per plant (weergave van de regels).

**Niet in v1:** AI-soortherkenning (PLA-6, Fase 3), plantendagboek-timeline (PLA-5, Fase 2 —
maar het schema bereidt het voor).

### D.2 Datamodel — migratie `0007_planten.sql`
```sql
-- 1. Soort-referentie (globaal, niet per huishouden). Read-only voor gebruikers;
--    geseed via een data-migratie. Regels zijn expres simpel en uitlegbaar.
create table if not exists public.plant_species (
  id              uuid primary key default gen_random_uuid(),
  common_name     text not null,           -- "Monstera"
  latin_name      text,                    -- "Monstera deliciosa"
  -- Verzorgingsregels per seizoen-paar (groei mrt–sep / rust okt–feb):
  water_days_growing int not null,         -- bijv. 7
  water_days_resting int not null,         -- bijv. 14
  feed_weeks_growing int,                  -- voeding elke N weken in groeiseizoen (null = niet)
  light           text check (light in ('schaduw','halfschaduw','licht','vol-zon')),
  care_notes      text,                    -- "gele blaadjes = te veel water"
  search          text                     -- genormaliseerd voor zoeken
);
create index if not exists plant_species_search_idx on public.plant_species using gin (to_tsvector('simple', coalesce(search,'')));

alter table public.plant_species enable row level security;
create policy plant_species_select on public.plant_species for select using (auth.uid() is not null);
-- (geen insert/update/delete-policy: alleen via migratie/service-role te vullen)

-- 2. Planten per huishouden — volgt het zichtbaarheidscontract.
create table if not exists public.plants (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,                       -- "Mostafa de Monstera"
  species_id    uuid references public.plant_species(id) on delete set null,
  location      text,                                -- "woonkamer", "balkon"
  photo_path    text,                                -- pad in Storage-bucket 'plants'
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists plants_household_idx on public.plants(household_id);
alter table public.plants add constraint plants_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);
select public.enable_module_rls('plants', 'created_by');

-- 3. Koppel de gegenereerde verzorgingstaken aan hun plant (zodat ze opruimbaar zijn
--    als de plant weg is, en zichtbaar op de plant-kaart).
alter table public.tasks add column if not exists plant_id uuid
  references public.plants(id) on delete cascade;
```

> **Beslissing:** `plant_species` is globaal en read-only (geseed via migratie), niet per
> huishouden — de soortkennis is generiek. De *planten* zijn wél per huishouden en
> subgroep-gescoped (een privé-plant op je eigen kamer kan). De verzorgingstaken zijn gewone
> `tasks` met `plant_id` + `category='plant'`, dus ze verschijnen automatisch in **Vandaag**
> en erven de zichtbaarheid die je op de plant zet.

### D.3 Foto-opslag
Supabase Storage-bucket `plants` (private). Upload via `expo-image-picker` →
`supabase.storage.from('plants').upload(...)`; bewaar het pad in `plants.photo_path`; toon via
een signed URL. RLS-policy op de bucket: alleen leden van het huishouden.
Voeg toe: `npx expo install expo-image-picker`.

### D.4 Domeinlogica — `lib/plantCare.js` (puur, testbaar)
```js
// Bepaalt of we nu in het groei- of rustseizoen zitten (NL: groei mrt–sep).
export function season(date) { ... } // -> 'growing' | 'resting'

// Genereert verzorgingstaken-payloads voor een plant op basis van zijn soort + seizoen.
// Geeft terug: [{ title:'Water geven', category:'plant', plant_id, recur_freq:'daily',
//   recur_interval: water_days, due_date }, { title:'Voeding', recur_freq:'weekly', ... }]
export function buildCareTasks(plant, species, { startDate }) { ... }

// Leesbare verzorgingskaart-velden uit de soortregels (voor PLA-4).
export function careCard(species, location) { ... } // -> { light, waterText, feedText, notes }
```
De watergift wordt een terugkerende taak met `recur_freq:'daily'`, `recur_interval` =
`water_days_growing`/`_resting` afhankelijk van het seizoen. Bij seizoenswissel hoeft niets
ge-herbouwd: bij elke afvink-doorrol (via `nextDueDate`) kan een latere verfijning het interval
herzien — voor v1 is een vast interval per aanmaakmoment voldoende.

Units in `tests/plantCare.test.js`: seizoensgrens (eind feb / begin mrt), water-interval kiest
het juiste seizoen, voeding alleen in groeiseizoen, geen voeding als `feed_weeks_growing` null is.

### D.5 Data-toegang — `lib/usePlants.js`
```js
export function usePlants() {
  const c = useCollection('plants', { label: 'planten', order: [{ column: 'created_at', ascending: false }] });
  // addPlant: insert plant -> daarna buildCareTasks -> tasks insert (via useTasks().addTask).
  return { plants: c.items, loading: c.loading, addPlant, updatePlant: c.update, removePlant: c.remove };
}
```
Soorten apart laden (read-only): een simpele `usePlantSpecies()` of een eenmalige fetch met
client-side zoeken (paar honderd rijen is klein genoeg).

### D.6 Schermen
- **`app/(tabs)/planten.js`**: grid/lijst van planten met foto + naam + "volgende beurt"
  (afgeleid uit de gekoppelde `tasks`). `Empty` bij geen planten. FAB "+".
- **`app/plant/new.js`**: foto maken/kiezen, naam, locatie, soort-picker (zoekveld op
  `plant_species`), `VisibilityPicker`. Bij opslaan → plant + automatisch de verzorgingstaken.
- **`app/plant/[id].js`**: verzorgingskaart (`careCard`), de gekoppelde terugkerende taken,
  fotostrook (voorbereiding PLA-5).
- Registry-descriptor:
  ```js
  { key: 'planten', label: 'Planten', emoji: '🪴', route: 'planten', kind: 'data', table: 'plants', creatorColumn: 'created_by' },
  ```

### D.7 Soortdatabase seeden
Een data-migratie `0008_plant_species_seed.sql` met een `insert ... values` van ~100–300
populaire kamer-/tuinplanten. Bron: een eenmalig samengestelde CSV → SQL. Begin klein
(top 50) en breid uit; de handmatige soortkeuze blijft altijd terugval als een soort ontbreekt
(`species_id` mag null, dan vraagt de UI om een handmatig water-interval).

### D.8 Edge cases
- Plant zonder soort (`species_id` null): UI vraagt zelf om een water-interval → nog steeds
  terugkerende taken, alleen zonder verzorgingskaart.
- Plant verwijderen ruimt de gekoppelde taken op (`on delete cascade` op `tasks.plant_id`).
- Seizoenswissel midden in een interval: geen herberekening v1 (bewust); documenteer als
  bekende vereenvoudiging.

### D.9 Deelstappen
1. **PLA-2** migratie `0007` (species + plants + `plant_id`) + `0008` seed (top 50) + RLS.
2. **PLA-1** `usePlants` + foto-upload + lijst-scherm + nieuwe-plant-scherm (handmatige soort).
3. **PLA-3** `plantCare.js` + auto-genereren verzorgingstaken + units.
4. **PLA-4** verzorgingskaart-detail-scherm.

---

## E. Overkoepelende volgorde & dependencies

| Module      | Nieuwe migratie(s) | Nieuwe lib                          | Nieuwe schermen                          | Leunt op            |
|-------------|--------------------|-------------------------------------|------------------------------------------|---------------------|
| Agenda      | `0004`             | `agenda.js`                         | `(tabs)/agenda.js`                       | tasks, recurrence   |
| Schoonmaak  | `0005`             | `cleaningTemplates.js`, `useZones`  | `(tabs)/schoonmaak.js`                   | tasks, recurrence   |
| Kosten      | `0006`             | `expenses.js`, `useExpenses`        | `(tabs)/kosten.js`, `expense/new.js`     | subgroups, framework|
| Planten     | `0007`, `0008`     | `plantCare.js`, `usePlants`         | `(tabs)/planten.js`, `plant/new+[id].js` | tasks, Storage      |

**Aanbevolen leverstroom:** Agenda eerst (geen nieuw datamodel, snelste zichtbare winst en
het maakt subgroepen tastbaar) → Schoonmaak (kleine uitbreiding op tasks, levert de
template-flow) → Kosten (eerste echt nieuwe module met child-tabel + RPC; meeste nieuwe
logica) → Planten (meeste oppervlakte: Storage, seed, soort-UI).

Elke module is **onafhankelijk** te bouwen en te releasen omdat het framework de gedeelde laag
levert. Per module geldt de definition-of-done: migratie + `enable_module_rls`/policies,
`constants.js` in sync, pure helpers met `node:test`-units, scherm geregistreerd in
`modules.js`, en handmatig getest met twee accounts in één huishouden (zichtbaarheid +
realtime).
