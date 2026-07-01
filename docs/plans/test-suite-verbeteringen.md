# Plan — verbeteringen aan de testsuite

> Status: **voorstel** (nog niet ingepland). Dit doc bevat een survey van de huidige
> teststand + een geprioriteerde lijst verbeteringen. Er zijn met dit plan **geen
> code-wijzigingen** doorgevoerd — het is puur richting.

## Huidige stand (survey, juli 2026)

| Meting | Aantal |
|---|---|
| Testbestanden (`tests/*.test.js`) | 65 |
| Testcases die de runner draait (`node:test`) | 557 |
| `test()`-aanroepen statisch (incl. subtests) | ~857 |
| Geteste `lib/*.js`-modules | ~63 van 123 lib-bestanden |

**Types die we hebben:**

1. **Unit-tests op pure logica-modules** — de meerderheid (~60 bestanden). Elke
   `lib/*.js` met business-logica heeft een naast-liggende `*.test.js`. Runner:
   ingebouwde `node:test` + `node:assert/strict`, geen extern framework.
2. **Integratie** — precies één: `rls.integration.test.js` (Supabase RLS tegen een echte DB).
3. **Meta-/guardrail-tests** — bewaken de test-infra zelf: `groupsCoverage`,
   `typecheckCoverage`, `codeEquivalence`, `constants-sync`.
4. **A11y-borging** — `contrast.test.js` (WCAG-AA-drempels van de palette-tokens).
5. **Mutatietesten (Stryker)** — kwaliteitspoort in CI (`scripts/mutation*.mjs`),
   ratchet per module, mik op ~85%.

**Niet aanwezig:** component-/snapshot-tests, hook-tests, en E2E in de suite
(end-to-end gaat via Maestro, `npm run rooktest`, flows in `.maestro/`).

## Geprioriteerde verbeteringen

### 1. Grootste gat: de React-/hook-laag is 100% ongetest
De ~30 `use*`-hooks (`useCollection`, `useEntityForm`, `useExpenses`, `useTasks`, …)
hebben geen test, terwijl daar gedragslogica zit: optimistic updates,
cache-invalidatie, realtime-patching, form-state. Twee routes, in volgorde van onze
eigen doctrine (`docs/architectuur.md`):

- **1a. Trek logica verder naar pure modules** (goedkoopste winst, past bij de
  3-lagen-scheiding). `useEntityForm` leunt al op `formValidation` (getest); doe
  hetzelfde voor de reducers/mergers in `useCollection` en verwante hooks →
  verplaats naar testbare `lib/*.js`.
- **1b. Waar dat niet kan, dunne hook-tests** (`react-test-renderer` /
  `@testing-library/react-hooks`). Focus op de gedeelde `useCollection` /
  `useEntityForm` — één test dekt veel modules — niet op elke wrapper.

### 2. Meet wat we niet meten — line/branch-coverage naast de ratchet
De mutatie-ratchet draait alleen op de `GROUPS`-modules; we hebben geen totaalbeeld
van welke regels/branches überhaupt geraakt worden. `node --test
--experimental-test-coverage` (of `c8`) geeft in seconden een globale kaart. Niet als
poort (dat is de ratchet al), maar als spiegel om blinde vlekken te vinden — met name
de hooks/wrappers uit punt 1.

### 3. Dicht de goedkope pure-data-gaten
Een paar ongeteste modules zijn pure data/logica en triviaal testbaar (en horen per
DoD een test te hebben):
- `offCategoryMap.js` — pure mapping, ideaal voor een tabel-test.
- `i18nRuntime.js`, `moduleHelp.js`, `notificationPrefs.js` — logica zonder zware
  side-effects.

De overige ongeteste niet-React-modules (`auth`, `household`, `db`, `supabase`,
`openFoodFacts`, `barcodeLookup`) zijn I/O-wrappers → daar hoort integratie, geen unit.

### 4. Breid integratie uit voorbij RLS
We hebben één integratietest. De Supabase query-builders in
`db.js`/`household.js`/`auth.js` — waar de meeste runtime-bugs zitten — worden nergens
tegen een DB getest. Overweeg een kleine integratie-suite (of Supabase-branch via MCP)
die de kern-queries per module rookt. Houd 'm los van `npm test` zodat de unit-suite
snel blijft.

### 5. Maak de suite reproduceerbaar
Bij een verse checkout falen ~21 bestanden puur op ontbrekende deps (`date-fns` e.d.)
zolang `npm ci` niet gedraaid is. Vangnetten:
- Een **SessionStart-hook** (zie de `session-start-hook`-skill) die `npm ci` borgt in
  web-sessies.
- Een expliciete `npm ci`-stap vóór `npm test` in `ci.yml` (checken of die er al staat).

### 6. Kleinere punten
- **Snapshot-/visuele borging voor de SVG-illustraties** (`lib/illustrations.js`,
  `FairnessBars`, `YearHeatmapView`): één render-snapshot vangt onbedoelde
  path-wijzigingen die `contrast.test.js` niet ziet.
- **`describe`-groepering**: 0 describe-blokken op 557 tests → platte output.
  Cosmetisch, maar groepering maakt falen sneller leesbaar.

## Voorgestelde volgorde
1. **Coverage-rapport draaien** (punt 2) — niet-invasief, geeft meteen de scherpste
   prioriteitenlijst.
2. **`useCollection` / `useEntityForm` testbaar maken** (punt 1) — grootste
   risicoreductie.
3. Daarna de goedkope pure-data-gaten (punt 3) en reproduceerbaarheid (punt 5)
   meepakken.
