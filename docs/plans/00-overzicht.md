# Huishoek — Build-ready plannen (volgende ronde)

Dit zijn **implementatieklare** plannen voor de volgende ontwikkelronde. Elk plan is zo
geschreven dat je het in VSC direct kunt uitvoeren: migratie-SQL, pure logica + de te
schrijven tests, hooks, schermen, RLS, edge cases en een file-checklist. De plannen zijn
**onafhankelijk** en in elke volgorde te bouwen, met de afhankelijkheden hieronder.

> Bron: [`huishoek-backlog.md`](../../huishoek-backlog.md) (§6 statustabel). Deze plannen
> werken de openstaande Fase 2/3-items en cross-cutting platform-/infra-items uit.
>
> **Let op — dit is ontwerp-onderbouwing, geen status.** Veel van deze plannen zijn inmiddels
> (deels) gebouwd. De actuele status staat uitsluitend in de backlog §6; lees deze plannen als
> historische rationale bij hoe iets bedoeld is.

## De plannen

| # | Plan | Backlog-items | Soort | Migratie? |
|---|------|---------------|-------|-----------|
| 01 | [Taakvoltooiingen, eerlijkheid & beurtrotatie](./01-taakvoltooiingen-eerlijkheid-rotatie.md) | SCH-3, KLU-4 (+ fundament) | Architectuur + features | Ja |
| 02 | [Boodschappen-intelligentie](./02-boodschappen-intelligentie.md) | BOO-5, BOO-3, BOO-2 | Feature (datalaag) | Ja |
| 03 | [Grote aankopen-module](./03-grote-aankopen.md) | AAN-1 t/m AAN-4 | Nieuwe module | Ja |
| 04 | [Kosten & autodelen uitbreiding](./04-kosten-autodelen.md) | KOS-3, KOS-4, AUT-1, AUT-2 | Module-uitbreiding | Ja |
| 05 | [Notificaties & herinneringen](./05-notificaties.md) | PLT-1 | Cross-cutting platform | Optioneel |
| 06 | [Platform-hardening](./06-platform-hardening.md) | INF-6, INF-3, INF-4, INF-5 | Infra/kwaliteit | Nee |
| 07 | [Strakke app (Fase 1.5)](./07-strakke-app.md) | STR-1 t/m STR-11 | UX-cohesie + interactie-polish + IA | Nee |
| 08 | [Professionele app: hardening & afmaken](./08-professioneel-hardening.md) | INF-3/4/5/7, STR-7/9/10, INF-1-rest | Productie-readiness | Nee |
| 09 | [Slimme keuken-loop](./09-slimme-keuken.md) | MLT-1, MLT-2, VOO-1 | Twee nieuwe modules (op de catalogus) | Ja |
| 10 | [Taken-pagina redesign](./10-taken-redesign.md) | TKN-1, TKN-3 (TKN-2 onderzoek) | UX-redesign + pure logica | Nee |
| 11 | [Interactie- & navigatie-polish](./11-interactie-navigatie-polish.md) | UX-6, UX-10 | Design-systeem + cross-cutting | Nee |
| 12 | [Vandaag widget-grid](./12-vandaag-widgetgrid.md) | VDG-1 t/m VDG-8 | Home-epic (gefaseerd) | Optioneel (VDG-4) |
| 13 | [Kleine features op bestaande data](./13-kleine-features.md) | PLA-8, BOO-8 | Twee kleine features | Nee |
| 14 | [Module-voor-module UX-ontleding (Fase 1.6)](./14-ux-module-teardown.md) | UXR-1 t/m UXR-8, UX-15 t/m UX-21 | UX-diepgang | Nee |
| 15 | [Keuken, boodschappen-koppeling, week-swipe & widgets](./15-keuken-boodschappen-widgets.md) | (eten/boodschappen + Vandaag-widgets) | UX + pure logica | Nee |
| 16 | [Performance-audit & echte wins](./16-performance-audit.md) | PERF-3 t/m PERF-8 | Kwaliteit/perf (5-agent-audit) | Deels (PERF-8) |
| 17 | [Security-remediatie](./17-security-remediatie.md) | SEC-1 t/m SEC-7 (+ INF-9/INF-10) | Security/hardening (3-agent-audit) | Ja (meerdere) |
| 18 | [Verbeterplan UX/a11y/correctheid/perf](./18-ux-verbeterplan.md) | A11Y-1/2, UX-43/44, PERF-9, INF-11, BOO-12 | Kwaliteit/UX (4-agent-audit) | Nee |
| 19 | [Tijdlijn / Prikbord](./19-tijdlijn-prikbord.md) | TML-1 t/m TML-8 | Nieuwe module (upgrade van PLT-6) | Ja |
| 20 | [Teardown Schoonmaak](./20-schoonmaak-teardown.md) | UXR-9, SCH-4 | UX-teardown-voorbereiding | Nee |
| 21 | [Teardown Zorg-modules](./21-zorg-teardown.md) | UXR-6, PLA-10 | UX-teardown-voorbereiding | Nee |
| 22 | [Formulier-fundament](./22-formulier-fundament.md) | ARCH-5 | Fundament + Taken-pilot (rollout-staart) | Nee |
| 23 | [Huishoek Assistent (AI-laag)](./23-assistent.md) | AI-1 | Nieuwe module (design-verkenning + fasering 0–6) | Ja (edge fn + tabellen + Orq) |
| 24 | [Assistent volwassen](./24-assistent-volwassen.md) | AI-2 t/m AI-9 | Observability/evals/UX/A2UI/geheugen (8 rondes) | Ja (deployment, evals, 0069/0071) |
| 25 | [iOS-readiness (spijtvrije route)](./25-ios-readiness.md) | IOS-1 | Platform/testroute-strategie (enabler + reality-check) | Nee |
| 26 | [Interactieve gen-UI-componenten](./26-gen-ui-componenten.md) | AI-16 (+ AI-7-beslissing) | Assistent-UI (chart/schedule/choice + live herrekening) | Nee |
| 27 | [Ontwikkelprogramma juli (review + golven)](./27-ontwikkelprogramma-juli.md) | AI-19/20, AI-9/11/16r3, PLT-3/7/8, DOC-1, TML-4/6, SEC/ARCH-staart | Programma-plan (gevalideerd, gefaseerd) | Ja (0075–0079, toewijzing in plan) |

> **Build-historie staat hier niet.** Welke ronde wanneer is gebouwd/gemerged — de keuken-loop
> (09/05/04), de no-device-ronde (10–13), het performance-pakket en de consolidatie van de drie
> audits (16–18) in de backlog — staat chronologisch in
> [`huishoek-voortgang.md`](../../huishoek-voortgang.md); de actuele status per item uitsluitend in
> [backlog §6](../../huishoek-backlog.md). Dit document blijft de **platte plan-index +
> ontwerp-onderbouwing**, geen logboek.

## Aanbevolen volgorde & afhankelijkheden

```
01 (voltooiingen-log) ──► SCH-3 eerlijkheid, KLU-4 rotatie
02 (boodschappen)     ──► BOO-5 catalogus ──► BOO-3 prijstracker ──► BOO-2 bonnetje
04 (kosten/autodelen) ──► leunt op bestaande Kosten (0007); AUT-2 leunt op AUT-1
03 (grote aankopen)   ──► onafhankelijk (eigen module)
05 (notificaties)     ──► onafhankelijk; raakt elke module licht
06 (platform)         ──► onafhankelijk; INF-6 (i18n) liefst vroeg (raakt alle strings)
07 (strakke app)      ──► onafhankelijk; geen migratie; doe dit eerst (Fase 1.5)
09 (keuken-loop)      ──► leunt op de catalogus (0013/0014); menu→lijst (−voorraad)→voorraad
05 (notificaties)     ──► maakt 09 + bestaande modules proactief (diner/voorraad/taken)
04 (kosten/autodelen) ──► KOS-3 bon→uitgave leunt nu op de gebouwde purchases (0013)
```

Waarde-per-inspanning: doe **07 (strakke app)** als eerste — het maakt de bestaande
app echt af vóór er nieuwe features bijkomen, en is goedkoop (alleen toepassen wat al
bestaat). Daarna **01** (klein, ontsluit twee features en repareert een echte
datatekortkoming) en **02** (grootste gebruikerswaarde). **06/INF-6 (i18n)** is
goedkoper naarmate je het eerder doet — het liefst vóór de grote string-migratie in 07.

## Hoe te gebruiken in VSC

Elk plan eindigt met een **file-checklist** (nieuw/gewijzigd) en **acceptatiecriteria**.
Werk per plan van boven naar beneden: migratie → pure logica + tests (`npm test`) →
hook → scherm → registratie/navigatie → handmatige rooktest. Commit per logische stap.

---

## Gedeelde conventies (cheat-sheet)

Alle plannen gaan hiervan uit; ze herhalen het niet. Dit is de bestaande architectuur.

### Migraties (`supabase/migrations/NNNN_naam.sql`)
- **Idempotent**: `create table if not exists`, `drop policy if exists` vóór `create policy`,
  realtime via een `do $$ … pg_publication_tables …` block.
- **Nummering**: gebruik het eerstvolgende vrije nummer in `supabase/migrations/`; lees de live stand via
  `list_migrations` (MCP) / `supabase migration list` (géén hardgecodeerd nummer). De plannen noemen
  relatieve namen; ken een nummer toe op het moment van bouwen.
- **Module-tabel met zichtbaarheidscontract** (een "item" dat gedeeld kan worden):
  kolommen `household_id`, een creator-kolom, `visibility` / `share_subgroup_id` /
  `share_with`, plus de consistentie-CHECK (zie hieronder), daarna één aanroep:
  ```sql
  select public.enable_module_rls('<tabel>', '<creator_col>');
  ```
  Dat zet RLS, de 4 policies (via `can_view`), de subgroep-integriteitstrigger én realtime aan.
- **Consistentie-CHECK** (verplicht bij het contract):
  ```sql
  alter table public.<tbl> add constraint <tbl>_visibility_consistent check (
    (visibility = 'subgroup' and share_subgroup_id is not null)
    or (visibility <> 'subgroup' and share_subgroup_id is null)
  );
  ```
- **Kind-tabel** (erft de zichtbaarheid van zijn parent, géén eigen visibility-kolommen):
  volg `expense_shares` (0007) / `plant_photos` (0011): RLS aan, een SELECT-policy met
  `exists(select 1 from <parent> p where p.id = <fk> and public.can_view(p.household_id,
  p.visibility, p.share_subgroup_id, p.share_with, p.<creator>))`, en een write-policy met
  `public.is_member(p.household_id)`. Realtime via het do-block.
- **Atomair samengesteld schrijven** (parent + kinderen in één transactie): een
  `security definer` RPC zoals `create_expense` (0007), aanroepen via `supabase.rpc(...)`.

### App-laag
- **Data**: `lib/db.js` → `run(query, { fallback, context })` voor selects,
  `mutate(query, { context })` voor writes (nette NL-foutmeldingen).
- **Standaard module-hook**: `useCollection('<tabel>', { order, creatorColumn, label })`
  → `{ items, loading, reload, create, update, remove, activeId, user }` (gescopet laden
  + realtime). Zie `lib/useTasks.js`.
- **Geneste data** (parent + kinderen): eigen hook met embedded select + dubbele
  realtime-subscription. Zie `lib/useExpenses.js`.
- **Zichtbaarheid**: `lib/visibility.js` → `visibilityPayload({ visibility, shareSubgroupId,
  shareWith })`, `validateVisibility(...)`, `canView(viewer, item, { householdMemberIds,
  subgroupMemberIds })`. UI-component `lib/VisibilityPicker.js`.
- **Geld**: altijd hele centen (int). `lib/expenses.js` → `formatCents`, `parseAmountToCents`.
- **UI**: bouw schermen uit `lib/ui.js` (`Button, Field, Card, Chip, ItemRow, FAB, Empty,
  ScreenHeader, ModalHeader, Stepper, Banner, Badge, SectionHeader, Avatar, Checkbox, Row,
  Stack, T, IconButton, Divider`) en tokens uit `lib/theme.js`. Iconen via `lib/icons.js`
  (`<Icon name="…">`): voeg nieuwe semantische namen toe aan de `MAP` (gebruik nooit een
  Phosphor-import rechtstreeks).
- **Nieuwe module**: (1) descriptor in `lib/modules.js` `MODULES` (`key, label, icon, route,
  kind, table, creatorColumn, core:false, primary`), (2) scherm `app/(tabs)/<route>.js`,
  (3) tabel via `enable_module_rls` in de migratie. `primary:false` ⇒ onder de "Meer"-tab.
  Detail-/editor-schermen onder `app/<ding>/[id].js` + `app/<ding>/_layout.js` (modal-stack).
- **Constants**: `lib/constants.js` spiegelt de CHECK-constraints; `tests/constants-sync.test.js`
  leest `0001` als autoriteit. Nieuwe enum-CHECKs in latere migraties: houd waarden in de
  betreffende `lib/*`-module en breid de sync-test uit als je ze daar wilt borgen.

### Tests
- **Pure units**: `node:test` onder `tests/*.test.js` (geen React/Supabase). `loader.mjs`
  lost extensieloze imports op. Mirror een bestaande test (bijv. `tests/expenses.test.js`).
- **RLS-integratie**: `tests/rls.integration.test.js` (skippt zonder secrets). Voeg een
  case toe voor elke nieuwe kind-tabel die zijn parent-zichtbaarheid erft.
- Draai `npm test` na elke logica-stap; CI (`.github/workflows/ci.yml`) doet dit ook.

### Belangrijke bestaande beslissing om te kennen
Een **terugkerende taak rolt door** bij afvinken (`lib/useTasks.js` → `completeTask`):
`due_date` schuift op en `completed_at`/`completed_by` worden **gewist**. Er is dus geen
duurzame "wie deed wat"-historie op `tasks`. Plan 01 lost dit op met een voltooiingen-log
en is daarmee de bouwsteen voor eerlijkheid (SCH-3) én rotatie (KLU-4).
