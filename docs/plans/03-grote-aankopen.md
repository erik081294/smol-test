# Plan 03 — Grote aankopen-module

**Backlog:** AAN-1 (aankoop-dossier), AAN-2 (opties verzamelen), AAN-3 (vergelijktabel),
AAN-4 (stemmen & besluit). **Soort:** nieuwe module. **Migratie:** ja. **Afhankelijkheden:**
geen (gebruikt het bestaande subgroep-/zichtbaarheidsmodel).

## Waarom

Voor de "we denken na over een nieuwe wasmachine/auto/bank"-situaties: een gedeeld
**dossier** per overweging, met **opties** (kandidaten), een **vergelijktabel** op
zelfgekozen criteria, **voor/tegen** per lid en een **stemming** die tot een besluit leidt
— zodat een gezin samen kiest zonder eindeloze appjes. Het dossier is subgroep-scoped
(de ouders overleggen; de kinderen zien het niet als dat zo gekozen is).

## Datamodel — migratie `NNNN_grote_aankopen.sql`

Het **dossier** volgt het zichtbaarheidscontract (`enable_module_rls`); alle onderliggende
tabellen zijn **kind-tabellen** die de zichtbaarheid van het dossier erven (patroon
`expense_shares`/`plant_photos`).

```sql
-- 1. Dossier (volgt het contract).
create table if not exists public.purchase_decisions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  title         text not null,
  notes         text,
  budget_min_cents int,
  budget_max_cents int,
  deadline      date,
  status        text not null default 'open' check (status in ('open','decided','cancelled')),
  chosen_option_id uuid,                       -- FK toegevoegd ná decision_options (zie onder)
  visibility    text not null default 'household' check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists decisions_household_idx on public.purchase_decisions(household_id);
alter table public.purchase_decisions drop constraint if exists decisions_visibility_consistent;
alter table public.purchase_decisions add constraint decisions_visibility_consistent check (
  (visibility='subgroup' and share_subgroup_id is not null)
  or (visibility<>'subgroup' and share_subgroup_id is null));
select public.enable_module_rls('purchase_decisions', 'created_by');

-- 2. Opties (kandidaten).
create table if not exists public.decision_options (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  decision_id  uuid not null references public.purchase_decisions(id) on delete cascade,
  title        text not null,
  url          text,
  price_cents  int,
  photo_path   text,                            -- optioneel (bucket 'receipts' of nieuw 'decisions')
  notes        text,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists decision_options_idx on public.decision_options(decision_id);
-- nu de chosen_option_id-FK leggen:
alter table public.purchase_decisions
  add constraint decisions_chosen_fk foreign key (chosen_option_id)
  references public.decision_options(id) on delete set null;

-- 3. Voor/tegen/notitie per lid op een optie.
create table if not exists public.decision_remarks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  option_id    uuid not null references public.decision_options(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default 'note' check (kind in ('pro','con','note')),
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists decision_remarks_idx on public.decision_remarks(option_id);

-- 4. Criteria + waarden (vergelijktabel, AAN-3).
create table if not exists public.decision_criteria (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  decision_id  uuid not null references public.purchase_decisions(id) on delete cascade,
  name         text not null,
  sort_order   int not null default 0
);
create table if not exists public.option_criteria_values (
  household_id uuid not null references public.households(id) on delete cascade,
  option_id    uuid not null references public.decision_options(id) on delete cascade,
  criterion_id uuid not null references public.decision_criteria(id) on delete cascade,
  value        text,
  primary key (option_id, criterion_id)
);

-- 5. Stemming (AAN-4): één stem per lid per dossier.
create table if not exists public.decision_votes (
  household_id uuid not null references public.households(id) on delete cascade,
  decision_id  uuid not null references public.purchase_decisions(id) on delete cascade,
  option_id    uuid not null references public.decision_options(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (decision_id, profile_id)
);
```

### RLS voor de kind-tabellen (allemaal hetzelfde patroon, erven via het dossier)
Voor elke kind-tabel: RLS aan; SELECT via `exists(... purchase_decisions d where d.id =
<decision_id> and can_view(d.…))`; write via `is_member(d.household_id)`. Voor tabellen die
via `option_id` hangen (`decision_remarks`, `option_criteria_values`, `decision_votes`),
join eerst naar `decision_options` → `purchase_decisions`. Schrijf een helper-DO-loop of
expliciete policies; voorbeeld voor `decision_options`:
```sql
alter table public.decision_options enable row level security;
drop policy if exists decision_options_select on public.decision_options;
create policy decision_options_select on public.decision_options for select using (
  exists (select 1 from public.purchase_decisions d where d.id = decision_id
    and public.can_view(d.household_id, d.visibility, d.share_subgroup_id, d.share_with, d.created_by)));
drop policy if exists decision_options_write on public.decision_options;
create policy decision_options_write on public.decision_options for all
  using (exists (select 1 from public.purchase_decisions d where d.id = decision_id and public.is_member(d.household_id)))
  with check (exists (select 1 from public.purchase_decisions d where d.id = decision_id and public.is_member(d.household_id)));
```
Realtime: voeg `purchase_decisions, decision_options, decision_remarks,
option_criteria_values, decision_votes` toe via het bekende do-block.

> **Stem-integriteit (optioneel maar netjes):** een trigger die checkt dat
> `decision_votes.option_id` bij hetzelfde `decision_id` hoort (en idem voor
> `chosen_option_id`). Vergelijkbaar met `check_subgroup_household` in 0003.

## Pure logica — `lib/decisions.js` (nieuw)
```js
import { formatCents } from './expenses';
// Stemmen tellen per optie. votes:[{option_id, profile_id}], options:[{id,title}]
export function tallyVotes(options, votes) { /* -> [{optionId, title, count}] desc, stabiel */ }
export function leadingOption(options, votes) { /* winnende optie of null bij gelijkspel/0 */ }
// Budget-label: "€500–€800" / "tot €800" / "vanaf €500" / "geen budget".
export function budgetLabel(minCents, maxCents) { /* … (gebruikt formatCents) */ }
// Past een optieprijs binnen het budget? -> 'binnen' | 'boven' | 'onbekend'
export function withinBudget(priceCents, minCents, maxCents) { /* … */ }
```

### Units — `tests/decisions.test.js`
- `tallyVotes` telt en sorteert (stabiel op id), 0 stemmen → count 0; `leadingOption`
  geeft null bij gelijkspel; `budgetLabel` dekt alle vier de vormen; `withinBudget`-grenzen.

## Hook — `lib/useDecisions.js`
- Lijst: `useCollection('purchase_decisions', { order:[{column:'created_at',ascending:false}] })`.
- Detail: eigen loader (zoals `useExpenses`) die één dossier laadt met embedded
  `decision_options(*, decision_remarks(*)), decision_criteria(*), option_criteria_values(*),
  decision_votes(*)`, plus realtime op die tabellen. Acties: `addOption`, `addRemark`,
  `setCriterion`, `setCriterionValue`, `castVote` (upsert op `(decision_id, profile_id)`),
  `decide(optionId)` (zet `status='decided'`, `chosen_option_id`).

## UI
- **Module registreren** in `lib/modules.js`: `{ key:'aankopen', label:'Aankopen',
  icon:'purchases', route:'aankopen', kind:'data', table:'purchase_decisions',
  creatorColumn:'created_by', core:false, primary:false }` (onder "Meer"). Voeg een icoon
  `purchases` toe in `lib/icons.js` (bijv. Phosphor `ShoppingBag`/`Tag`).
- **`app/(tabs)/aankopen.js`**: lijst van dossiers (`ItemRow`/`Card`) met titel,
  `budgetLabel`, deadline, status-`Badge`, en het aantal opties. `FAB` → nieuw dossier.
- **`app/decision/[id].js`** (+ `_layout.js`): dossierkop (titel, budget, deadline,
  `VisibilityPicker`), **opties** als kaarten (titel, prijs + `withinBudget`-`Badge`, link,
  foto, voor/tegen-lijst met toevoegen), een **vergelijktabel** (criteria als rijen, opties
  als kolommen — horizontaal scrollbare grid van `Field`-cellen), een **stemsectie**
  (tik een optie om te stemmen; toon `tallyVotes`-balken) en een **"Besluit vastleggen"**
  knop (`decide`) die de gekozen optie markeert en het dossier op `decided` zet.

## Edge cases & beslissingen
- **Foto's**: hergebruik het Storage-patroon (bucket `receipts` of een nieuwe `decisions`).
  Optioneel; opties kunnen ook alleen een URL hebben.
- **Vergelijktabel** kan breed worden: horizontale `ScrollView`; houd cellen als korte
  vrije tekst (geen typed velden) — eenvoud boven volledigheid.
- **Stemmen vs. besluit**: stemming is adviserend; `decide()` is de expliciete keuze
  (meestal de leidende optie, maar de beslisser mag afwijken).
- **Subgroep-scoping** werkt out-of-the-box via het contract; de integriteitstrigger uit
  0003 dekt `purchase_decisions.share_subgroup_id`.

## Acceptatiecriteria
- Dossier aanmaken met budget + deadline, 3 opties toevoegen, per optie voor/tegen +
  criteria invullen, leden stemmen, besluit vastleggen → status `decided`, gekozen optie
  gemarkeerd, niet-leden van de subgroep zien het dossier niet.
- `npm test` groen incl. `decisions`; RLS-integratietest: een kind-tabel (bijv.
  `decision_options`) erft de dossier-zichtbaarheid.

## File-checklist
**Nieuw:** `supabase/migrations/NNNN_grote_aankopen.sql` · `lib/decisions.js` ·
`lib/useDecisions.js` · `app/(tabs)/aankopen.js` · `app/decision/[id].js` +
`app/decision/_layout.js` · `tests/decisions.test.js`
**Gewijzigd:** `lib/modules.js` (descriptor) · `lib/icons.js` (`purchases`-icoon) ·
`app/(tabs)/_layout.js` indien nodig (de tabbalk leest `MODULES`, meestal automatisch) ·
`tests/rls.integration.test.js` (kind-tabel erft) · `huishoek-backlog.md` (AAN-1..4 status).
