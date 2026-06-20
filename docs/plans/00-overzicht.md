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
| 07 | [Strakke app (Fase 1.5)](./07-strakke-app.md) | STR-1 t/m STR-11 | UX-cohesie + interactie-polish + IA | Nee |
| 08 | [Professionele app: hardening & afmaken](./08-professioneel-hardening.md) | INF-3/4/5/7, STR-7/9/10, INF-1-rest | Productie-readiness | Nee |
| 09 | [Slimme keuken-loop](./09-slimme-keuken.md) | MLT-1, MLT-2, VOO-1 | Twee nieuwe modules (op de catalogus) | Ja |

> **Volgende ronde (gekozen 2026-06-20): drie elkaar versterkende features** met maximale
> gebruikerswaarde — **09 Slimme keuken-loop** (Maaltijden + Voorraad, bovenop de catalogus),
> **05 Notificaties** (geactualiseerd: lokaal + remote, incl. maaltijd-/voorraad-herinneringen)
> en **04 Kosten & autodelen** (geactualiseerd: bon→uitgave nu echt mogelijk via `purchases`).
> Samenhang: menu → lijst → voorraad → herinneringen → kosten. Aanbevolen volgorde **09 → 05 → 04**.
> **→ GEBOUWD (2026-06-20)** (migraties `0016`–`0018`), plus een vervolgronde met
> **kosten-inzichten & budget** (`0019`), **reserveringen-kalender** + **server-side recurring**
> (`0020`, `pg_cron`) en **FK-indexen** (`0021`). Getest (units groen, lint 0 errors, RLS-cases
> erbij). **Alle migraties `0016`–`0021` staan live (2026-06-20)**; resteert nog de toestel-rooktest
> — zie backlog §6 en `VERIFICATIE.md`. ✅
>
> *(Plannen 01, 02, 06/INF-6, 07 en 08 zijn (groten)deels gereed; zie backlog §6.)*

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
- **Nummering**: gebruik het eerstvolgende vrije nummer (nu is `0022` de laatste). De
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
