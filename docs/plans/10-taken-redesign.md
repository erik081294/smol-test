# Plan 10 — Taken-pagina redesign (tijdscope + filters)

**Backlog:** TKN-1 (tijdscope-switcher dag/week/maand/agenda), TKN-3 (schaalbare
filterbediening), TKN-2 (jaarweergave — alleen onderzoek). **Soort:** UX-redesign van een
bestaande tab + pure logica. **Migratie:** nee. **Afhankelijkheden:** geen (leunt op
`tasks`, `lib/agenda.js`, `lib/useTasks.js`).

## Waarom

`app/(tabs)/taken.js` toont nu **alle open taken plat** in één `FlatList` met een rij
categorie-chips + een open/af-toggle. Geen tijdsbesef (vandaag vs. later vs. achterstallig)
en de filterbalk schaalt niet als er meer assen bijkomen (persoon, subgroep, status). Tegelijk
bestaat er een aparte **Agenda-tab** (`app/(tabs)/agenda.js`, AGE-1) met precies de maandgrid
+ dag-lijst die de "Maand"-scope nodig heeft. Doel: één heldere Taken-pagina met een
**tijdscope-switcher** (Dag · Week · Maand) en een **schaalbare filter-bediening** (knop +
teller → bottom-sheet), met maximaal hergebruik van wat er al is.

## Beslissing: Taken ↔ Agenda (de open vraag uit TKN-1)

**Aanbeveling — coexistentie met een gedeeld maand-component (Optie C).** Extraheer de
maandgrid + daglijst uit `app/(tabs)/agenda.js` naar een herbruikbaar component
`lib/MonthView.js` (props: `tasks`, `subgroupId`, `selectedKey`, `onSelectDay`). De
**Maand**-scope in Taken rendert dit component; de Agenda-tab blijft als "pure kalender"
maar gebruikt hetzelfde component (DRY, geen dubbele grid-logica). Zo krijgen we de redesign
zónder een disruptieve tab-verwijdering. **Vervolgstap (apart, later):** als Maand-in-Taken
in de praktijk Agenda overbodig maakt, kan Agenda gedemoveerd/verwijderd worden in
`lib/modules.js` — dat is een kleine, omkeerbare losse change, geen onderdeel van dit plan.

## Pure logica — `lib/agenda.js` (uitbreiden) + units

Bestaand en te hergebruiken: `monthMatrix`, `groupByDate`, `filterBySubgroup`,
`dominantCategory`, `sortDayTasks`, `monthLabel`, `dateKey`, `parseKey`. **Toevoegen** (allemaal
puur, met units in `tests/agenda.test.js`):

```js
// Scope-groepering
export function groupByDay(tasks, date)   // -> { dated:[...op die dag...], undated:[...] }
export function weekDays(date)            // -> 7 dagen (ma-start) rond `date`: [{date,key,isToday}]
export function groupByWeek(tasks, date)  // -> { [key]: Task[] } voor de 7 dagen van die week

// Filter-predicaten (compose-baar) + telling voor de chip-badges
export const isOpen = (t) => !t.completed_at;
export const isDone = (t) => !!t.completed_at;
export const inCategory = (key) => (t) => t.category === key;
export const forAssignee = (id) => (t) => t.assigned_to === id;
// Eén filter-object toepassen (categorie/persoon/subgroep/status), genegeerd = default
export function applyTaskFilters(tasks, { categories, assignees, subgroupId, status });
export function countBy(tasks, keyFn);    // generiek: -> Map/Record voor badge-tellers
export function activeFilterCount(filters); // aantal niet-default assen (voor de teller op de knop)
```

Hergebruik bestaande pure helpers: `isOverdue`/`dueLabel`/`recurrenceLabel` uit
`lib/recurrence.js` (achterstallig-markering en datumlabels), `nextAssignee` uit
`lib/rotation.js` (ongewijzigd, zit al in `useTasks.completeTask`).

## UI — `app/(tabs)/taken.js` (herschrijven) + componenten

**Tijdscope-switcher (TKN-1).** Een segmented control bovenaan: **Dag · Week · Maand**. Er is
nog geen segmented-control-component; bouw een kleine `SegmentedControl` in `lib/ui.js`
(rij van gelijke segmenten, één actief, `animateNextLayout()` bij wissel, respecteert
`prefersReducedMotion`). Houd 'm generiek (`options`, `value`, `onChange`) zodat hij elders
herbruikbaar is.
- **Dag**: `groupByDay(tasks, cursor)` → sectie "Op deze dag" (`sortDayTasks`) + sectie
  "Zonder datum". Dag-cursor met ‹ vandaag › (hergebruik de bestaande dag-navigatie-affordance).
- **Week**: `weekDays(cursor)` → 7 dag-secties (`SectionHeader` met dag-label + teller),
  lege dagen compact.
- **Maand**: render `lib/MonthView.js` (gedeeld met Agenda) — grid + daglijst.
- Achterstallige taken altijd zichtbaar bovenaan (Dag/Week) via `isOverdue`, los van scope.

**Filter-bediening (TKN-3).** Vervang de horizontale chip-rij door één **"Filter"-knop met
teller** (`activeFilterCount`) die een `BottomSheet` opent met gegroepeerde keuzes:
- **Categorie/module** — `Chip`-groep met `countBy`-badges (`categoryMeta` uit `theme.js`).
- **Toegewezen aan** — `AvatarSelect` (bestaat al, members uit `useHousehold`).
- **Zichtbaarheid/subgroep** — hergebruik `VisibilityPicker` (collapsible-modus) of een
  subgroep-`Chip`-rij (subgroups uit `useHousehold`).
- **Status** — open/af `Chip`-toggle.
Actieve filters tonen als verwijderbare chips boven de lijst + "Wis alles". Filterstaat in
component-state (geen persistentie nodig); scope en filters zijn orthogonaal en combineerbaar.

Hergebruik verder ongewijzigd: `TaskRow` (weergave), `useTasks()` (data + mutaties incl.
doorrol/logging), `ChoreLibrarySheet`, `FAB` (met het in UX-11 toegevoegde label).

## TKN-2 — Jaarweergave (alleen onderzoek, geen build)

Houd dit bewust klein: documenteer drie richtingen en kies later. (a) **activiteit-heatmap**
(GitHub-stijl) uit `task_completions`; (b) **12 mini-maanden** (reuse `monthMatrix`); (c)
**seizoensplanner** uit de `months`-velden van de klus-bibliotheek (KLU-3). Aanrader: begin
met (a) als read-only inzicht; voeg pas een aparte backlog-rij toe met scope na een korte
gebruikersuitvraag. Geen migratie verwacht.

## Edge cases & beslissingen
- **Lege scopes**: nette `Empty`-staat per scope (illustratie via `illustration`-prop).
- **Doorrollende taken**: ongewijzigd; `completeTask` schuift `due_date` en wist
  `completed_at` — de scope herberekent vanzelf na realtime-herlaad.
- **Performance**: alle groepering is puur en O(n) over de al-geladen takenlijst; geen extra
  queries. (PERF-1 venster-/limietwerk valt buiten dit plan.)
- **Toegankelijkheid**: segmented control en filterknop met `accessibilityRole`/labels;
  bewegingen via `animateNextLayout` (no-op bij reduced motion).

## Acceptatiecriteria
- Switchen tussen Dag/Week/Maand hergroepeert dezelfde takenlijst zonder nieuwe query;
  achterstallig blijft zichtbaar; Maand toont de gedeelde `MonthView`.
- Filteren op categorie + persoon + status tegelijk werkt, met live tellers en "Wis alles";
  de filterknop toont het aantal actieve assen.
- `npm test` groen incl. nieuwe `agenda`-units (groupByDay/weekDays/groupByWeek/
  applyTaskFilters/countBy/activeFilterCount). `npx eslint .` 0 errors.

## File-checklist
**Nieuw:** `lib/MonthView.js` (geëxtraheerd uit agenda-tab) · `SegmentedControl` in
`lib/ui.js` · uitbreidingen in `tests/agenda.test.js`.
**Gewijzigd:** `lib/agenda.js` (scope-/filter-helpers) · `app/(tabs)/taken.js` (herschrijven)
· `app/(tabs)/agenda.js` (gebruikt nu `MonthView`) · `lib/i18n.js` (scope-/filterlabels:
`tasks.scope.*`, `tasks.filter.*`) · `huishoek-backlog.md` (TKN-1/3 status).
**Onderzoek (geen code):** TKN-2 jaarweergave-notitie.
