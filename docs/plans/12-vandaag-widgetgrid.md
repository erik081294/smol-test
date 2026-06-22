# Plan 12 — Vandaag widget-grid (VDG-1 t/m VDG-8)

**Backlog:** VDG-1 (widget-framework: registry, descriptors, host), VDG-2 (grid-layout-engine),
VDG-3 (bewerkmodus drag-and-drop), VDG-4 (layout-persistentie + slimme defaults), VDG-5 (twee
stijlen per widget), VDG-6 (per-module kleur-/beeldtaal-tokens), VDG-7 (widget-bibliotheek ≥2
per module), VDG-8 (a11y, performance, reduced-motion). **Soort:** grote UX-epic op het
Home-scherm. **Migratie:** optioneel (alleen VDG-4 Optie A). **Afhankelijkheden:** FND-2
(modules), STR-3 (ui-cohesie), UX-1 (design-systeem).

## Waarom

`app/(tabs)/vandaag.js` is nu een vaste compositie: een **Focus-sectie** (vandaag/achterstallig
uit `useTasks`) plus een statische registry `HOME_CARDS` (`lib/home/cards.js`) die per
ingeschakelde module één `SummaryCard` (`lib/home/SummaryCard.js`) toont. Doel van de epic:
Home wordt een **modulaire, kleurrijke, door de gebruiker samen te stellen widget-grid** —
meerdere widgets per module (beknopt/uitgebreid), twee stijlen (speels/neutraal), zelf te
plaatsen/herschikken, met een slimme default. Het bestaande registry + kaart-skelet is de
ideale startbasis; `react-native-reanimated` (4.3.1) en `react-native-gesture-handler` (2.31.1)
zitten al in `package.json` (nog ongebruikt) — precies wat VDG-3 nodig heeft.

> **Aanpak: gefaseerd en grotendeels puur.** De waarde-dragende kern (registry + grid-engine +
> kleur/stijl + widget-bibliotheek) is **puur en unit-testbaar**; alleen de drag-and-drop-
> bewerkmodus vraagt device-validatie. Bouw in deze volgorde; elke fase staat op zichzelf.

## Fase A — Registry & host (VDG-1) + grid-engine (VDG-2)  · puur, geen migratie

**Widget-descriptors.** Generaliseer `HOME_CARDS` naar een echte registry `lib/widgets/registry.js`:
```js
// Eén descriptor per widget (een module kan er meerdere hebben).
{ key:'taken.focus', module:'taken', title, icon, sizes:['1x1','2x1'],
  defaultSize:'2x1', variant:'playful'|'neutral', Render }  // Render krijgt {data, size, style}
```
Widgets lezen data via de **bestaande module-hooks** (`useTasks`, `useGroceries`,
`useExpenses`, `useMealPlan`, `usePantry`, `usePlants`, `useActivity`) en geven een
samenvatting (stat + optionele preview + tone). Een **host** `lib/widgets/WidgetHost.js`
rendert een widget op basis van descriptor + gekozen grootte/stijl; `SummaryCard` blijft het
neutrale skelet.

**Grid-engine (puur, met units).** `lib/widgets/grid.js`:
```js
export function packGrid(placed, { cols = 2 });      // [{key,col,row,w,h}] -> geordende cellen
export function deriveDefaultLayout(modules, { cols = 2 });  // uit effectiveModules() -> layout
export function moveWidget(layout, key, toIndex);    // herschik (pure transform)
```
2 koloms op telefoon, meer op web/tablet; widget-spans 1×1 / 2×1 / 2×2. Geen React in de kern
→ test met verschillende module-sets en spans in `tests/widgets.test.js`.

Render in `app/(tabs)/vandaag.js`: Focus-sectie blijft bovenaan; daaronder de grid uit
`packGrid(layout)`. In Fase A is de layout = `deriveDefaultLayout(modules)` (nog niet bewerkbaar).

## Fase B — Kleur/beeldtaal (VDG-6) + twee stijlen (VDG-5) + bibliotheek (VDG-7) · puur

**Per-module tokens (VDG-6).** Voeg in `lib/theme.js` een `widgetColorSchemes`-map toe
(module → `{ playful:{icon,bg,accent}, neutral:{icon,bg,accent} }`), AA-contrast in licht én
donker (palet wordt via `applyTheme` gemuteerd; gebruik getters zoals `type`). Sluit aan op de
bestaande `categoryMeta`-accenten en op `lib/illustrations.js`. Pure helper
`getWidgetColorScheme(moduleKey, style)` met unit.

**Twee stijlen (VDG-5).** `WidgetHost` krijgt een `style`-as ('playful' | 'neutral'); zelfde
data, andere skin via de tokens. Toggle (later) in bewerkmodus.

**Widget-bibliotheek (VDG-7).** ≥2 widgets per module, beknopt + uitgebreid, allemaal op de
bestaande hooks:
- **Taken**: focus-lijst · voortgangsring "x/y af". **Boodschappen**: te-halen-teller ·
  mini-lijst · snel-toevoegen. **Kosten**: jouw saldo · maand-mini-grafiek (`BarChart` bestaat).
- **Planten**: water-vandaag · volgende beurt · cover-tegel. **Agenda**: vandaag · komende-week-
  strip. **Maaltijden**: "vanavond eten we…" · weekmenu-strip. **Voorraad**: bijna-op-teller ·
  urgente-lijst. **Activiteit**: feed-strip.
Elke widget puur in zijn data-afleiding (de samenvattingsberekening is unit-testbaar; de
hook-glue niet).

## Fase C — Persistentie + slimme defaults (VDG-4) · migratie optioneel

**Optie A (aanrader, gesynct) — nieuwe tabel** `home_layouts`, gespiegeld op het bestaande
`user_module_prefs`-patroon (per gebruiker per huishouden):
```sql
-- supabase/migrations/0036_home_layout.sql  (nummer op moment van bouwen)
create table if not exists public.home_layouts (
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  layout       jsonb not null default '[]',
  updated_at   timestamptz not null default now(),
  primary key (profile_id, household_id)
);
alter table public.home_layouts enable row level security;
drop policy if exists home_layouts_select on public.home_layouts;
create policy home_layouts_select on public.home_layouts for select using (profile_id = auth.uid());
drop policy if exists home_layouts_write on public.home_layouts;
create policy home_layouts_write on public.home_layouts for all
  using (profile_id = auth.uid() and public.is_member(household_id))
  with check (profile_id = auth.uid() and public.is_member(household_id));
-- realtime via het bekende do-block.
```
Laad/bewaar in `lib/household.js`-stijl (zoals `loadModuleSettings`/`setUserModule`). Default =
`deriveDefaultLayout(effectiveModules())` als er nog geen rij is.

**Optie B (lichter, lokaal) — AsyncStorage** onder `home_layout.${householdId}.${userId}`. Geen
sync/geen huishouden-default, maar nul migratie en instant. **Aanrader:** begin desnoods met B
om Fase A/B te ontsluiten, en migreer naar A wanneer cross-device sync gewenst is.

## Fase D — Bewerkmodus drag-and-drop (VDG-3) + a11y/perf (VDG-8) · device-validatie

**Bewerkmodus (VDG-3).** Long-press of "Aanpassen"-knop → cellen worden sleepbaar (Reanimated
`SharedValue` + gesture-handler `LongPressGesture`/`PanGesture`, `runOnJS` naar
`moveWidget`). Voeg/verwijder widgets via een gegroepeerde picker (per module), met live
preview. **Web-fallback:** geen drag; herschik via ↑/↓-knoppen of een menu (de pure
`moveWidget` werkt overal).

**A11y/perf/reduced-motion (VDG-8).**
- **Performance (belangrijk):** laad **alleen de hooks van geplaatste/zichtbare widgets** —
  voorkom dat álle module-hooks tegelijk realtime openen op Vandaag (sluit aan op INF-8/PERF-1).
  Lazy-mount per geplaatste widget.
- **Reduced motion:** check `prefersReducedMotion()` vóór Reanimated-animaties; grid-shifts via
  `animateNextLayout()` (al no-op bij reduced motion/web).
- **Screenreader:** sleep-alternatief ("verplaats omhoog/omlaag"-acties), 48dp-targets, AA-
  contrast óók in de speelse variant.

## Wat puur/test­baar is vs. device
**Puur (units in `tests/widgets.test.js`):** `packGrid`, `deriveDefaultLayout`, `moveWidget`,
`getWidgetColorScheme`, en de per-widget samenvattingsafleidingen. **Device-validatie:** drag-
and-drop, gestures, reduced-motion-gedrag, en de visuele kleur/stijl-controle (speels vs.
neutraal) — niet blind bouwen.

## Acceptatiecriteria (per fase)
- **A:** Home rendert de default-grid via de registry + `packGrid`; widgets tonen echte data;
  units groen.
- **B:** elke module heeft ≥2 widgets en beide stijlen; kleuren AA in licht/donker.
- **C:** layout overleeft herstart (Optie A: ook cross-device); default afgeleid uit
  ingeschakelde modules.
- **D:** widgets te plaatsen/herschikken/verwijderen op toestel; web-fallback werkt; reduced-
  motion gerespecteerd; geen hook-storm op Vandaag.
- Door alle fases: `npm test` groen, `npx eslint .` 0 errors.

## File-checklist
**Nieuw:** `lib/widgets/registry.js` · `lib/widgets/WidgetHost.js` · `lib/widgets/grid.js` +
`tests/widgets.test.js` · de widget-componenten (`lib/widgets/<module>/*`) · (Optie A)
`supabase/migrations/00XX_home_layout.sql`.
**Gewijzigd:** `app/(tabs)/vandaag.js` (host + grid + bewerkmodus) · `lib/theme.js`
(`widgetColorSchemes`) · `lib/home/SummaryCard.js` (stijl-as) · `lib/household.js` (layout
laden/bewaren bij Optie A) · `huishoek-backlog.md` (VDG-status).

> **Advies:** dit is de grootste epic en deels Fase 3. Bouw **A → B** eerst (pure waarde, geen
> migratie, geen device-afhankelijkheid); doe **C** wanneer sync gewenst is; bewaar **D**
> (drag-and-drop) tot er een toestel-validatieronde is. Splits desgewenst per fase in losse PR's.
