# Huishoek — Build-ready plannen (volgende ronde)

Dit zijn **implementatieklare** plannen voor de volgende ontwikkelronde. Elk plan is zo
geschreven dat je het in VSC direct kunt uitvoeren: migratie-SQL, pure logica + de te
schrijven tests, hooks, schermen, RLS, edge cases en een file-checklist. De plannen zijn
**onafhankelijk** en in elke volgorde te bouwen, met de afhankelijkheden hieronder.

> Bron: [`huishoek-backlog.md`](../../huishoek-backlog.md) (§6 statustabel). Deze plannen
> werken de openstaande Fase 2/3-items en cross-cutting platform-/infra-items uit.

## De plannen

| # | Plan | Backlog-items | Soort | Migratie? |
|---|------|---------------|-------|-----------|
| 01 | [Taakvoltooiingen, eerlijkheid & beurtrotatie](./01-taakvoltooiingen-eerlijkheid-rotatie.md) | SCH-3, KLU-4 (+ fundament) | Architectuur + features | Ja |
| 02 | [Boodschappen-intelligentie](./02-boodschappen-intelligentie.md) | BOO-5, BOO-3, BOO-2 | Feature (datalaag) | Ja |
| 03 | [Grote aankopen-module](./03-grote-aankopen.md) | AAN-1 t/m AAN-4 | Nieuwe module | Ja |
| 04 | [Kosten & autodelen uitbreiding](./04-kosten-autodelen.md) | KOS-3, KOS-4, AUT-1, AUT-2 | Module-uitbreiding | Ja |
| 05 | [Notificaties & herinneringen](./05-notificaties.md) | PLT-1 | Cross-cutting platform | Optioneel |
| 06 | [Platform-hardening](./06-platform-hardening.md) | INF-6, INF-3, INF-4, INF-5 | Infra/kwaliteit | Nee |

## Aanbevolen volgorde & afhankelijkheden

```
01 (voltooiingen-log) ──► SCH-3 eerlijkheid, KLU-4 rotatie
02 (boodschappen)     ──► BOO-5 catalogus ──► BOO-3 prijstracker ──► BOO-2 bonnetje
04 (kosten/autodelen) ──► leunt op bestaande Kosten (0007); AUT-2 leunt op AUT-1
03 (grote aankopen)   ──► onafhankelijk (eigen module)
05 (notificaties)     ──► onafhankelijk; raakt elke module licht
06 (platform)         ──► onafhankelijk; INF-6 (i18n) liefst vroeg (raakt alle strings)
```

Waarde-per-inspanning: begin met **01** (klein, ontsluit twee features en repareert een
echte datatekortkoming) en **02** (grootste gebruikerswaarde). **06/INF-6 (i18n)** is
goedkoper naarmate je het eerder doet.

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
- **Nummering**: gebruik het eerstvolgende vrije nummer (nu is `0011` de laatste). De
  plannen noemen relatieve namen; ken een nummer toe op het moment van bouwen.
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
