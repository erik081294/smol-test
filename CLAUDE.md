# Huishoek — werkafspraken voor AI-dev sessies

Huishoek is een Expo/React-Native app. De logica zit in pure modules onder `lib/*.js`
(los van React/Supabase), unit-getest met `node:test`. Schermen/hooks/UI zijn de dunne
React-laag eromheen.

## Waar staat wat (oriëntatie)

Begin hier; ga niet op je geheugen af — de code beweegt sneller dan losse docs.

- **Status & roadmap (wat af/open is) — single source of truth:**
  [`huishoek-backlog.md`](huishoek-backlog.md) §6. Géén andere doc is gezaghebbend over status.
- **Chronologisch logboek (wat wanneer is gebouwd):** [`huishoek-voortgang.md`](huishoek-voortgang.md).
- **Build-ready plannen (het *hoe*, per ronde):** [`docs/plans/00-overzicht.md`](docs/plans/00-overzicht.md).
- **Waarom/architectuur:** [`huishoek-backlog.md`](huishoek-backlog.md) §1 + [`README.md`](README.md).
- **Module-ruggengraat (zo blijft het modulair, geen spaghetti):**
  [`docs/architectuur.md`](docs/architectuur.md). Het gedeelde contract dat elke module volgt —
  `modules.js` → `useCollection` → `enable_module_rls`, de 3-lagen-scheiding (pure logica /
  React-schil / RLS), en de gedeelde entity-editor (`useEntityForm` + `formValidation`).
  Een nieuwe editor of cross-module overzicht? Lees dit eerst.
- **Migratie-/RLS-runbook:** [`VERIFICATIE.md`](VERIFICATIE.md). Live migratiestand: `supabase migration list`
  (lees geen hardgecodeerd nummer uit een doc). **`supabase db push` is in dit project kapot**
  (history diverged) → nieuwe migraties via MCP `apply_migration`.
- **Device-rooktest (snel & geautomatiseerd):** [`docs/rooktest.md`](docs/rooktest.md) —
  `npm run rooktest` draait de Maestro-flows op het USB-toestel + vangt logcat af en geeft één
  pass/fail-oordeel (i.p.v. handmatig tikken + screenshots lezen). Flows in [`.maestro/`](.maestro/).
- **Design-systeem:** [`DESIGN.md`](DESIGN.md). **Overige naslag/how-to & gedateerde reviews:**
  [`docs/README.md`](docs/README.md).

Onderstaande **definition of done** borgt onze integratiesnelheid: testgaten horen dicht
vóór de PR, niet pas bij de merge. (Deze sessie kostte een half uur omdat een PR pas bij
de merge op de mutatie-ratchet zakte — dat voorkomen we hiermee.)

## Definition of done — vóór je een PR opent

1. **Raakte je een gemuteerde module? Draai de mutatie-ratchet en dicht 'm tot groen.**
   Gemuteerd = elk bronbestand in de `GROUPS`-lijst in
   [`scripts/mutation-groups.mjs`](scripts/mutation-groups.mjs) (de `lib/*.js` met een unit-test;
   `scripts/mutation.mjs` her-exporteert die lijst en is de runner).
   ```bash
   node scripts/mutation-check.mjs --since=origin/main   # alleen je gewijzigde modules, ~1-2 min
   ```
   Dit is exact wat CI draait. Zakt een module onder zijn baseline, dicht het dan nú —
   niet ontdekken ná de merge.

2. **Elke nieuwe `export function` in `lib/*.js` krijgt een unit-test in dezelfde PR.**
   Geen losse functie zonder test mergen. Een test náást de functie vangt vrijwel de hele
   ratchet-daling af nog vóór de mutatietest eraan te pas komt — dit is de goedkoopste fix.

3. **Raakte je een pure logica-module? Houd de type-laag groen:** `npm run typecheck`.
   De `MUTATED_SOURCES`-modules draaien opt-in onder `// @ts-check` (scope: `tsconfig.check.json`),
   met `strict` bewust uit — het vangt verkeerde shapes/arg-fouten, niet elke null. Nieuwe pure
   module? Zet `// @ts-check` op regel 1 én neem 'm op in de `include` van `tsconfig.check.json`
   (de meta-test `tests/typecheckCoverage.test.js` bewaakt dit). Houd een fix **type-only**
   (JSDoc / `@type`-cast): de runtime-code — en dus de mutatie-score — mag niet wijzigen.

4. **Volledige suite groen:** `npm test`.

5. **Verschoof je een feit dat een doc beweert? Werk die doc in dezelfde PR bij.**
   Status leeft op één plek: backlog §6 (lopend/open) + het archief (✅). Raak je iets aan dat
   een doc als waar neerzet — een migratie live, een test groen/rood, een feature verscheept,
   een 🔧 dat op toestel bevestigd is — corrigeer dan de bijbehorende rij *vóór* de merge. Drie
   vaste reflexen:
   - **Verifieer status tegen de bron, niet tegen de doc.** Migratiestand via MCP
     `list_migrations` (of `supabase migration list`), RLS via de live-suite, build-status via de
     run — nooit via een nummer/claim dat ergens is overgetypt. (Dit beet ons: §6 zei "0036 live"
     terwijl de DB op `0057` stond, en twee rijen claimden "nog live zetten" voor migraties die
     al live waren.)
   - **Eén feit, één plek.** Zet build-historie in [`huishoek-voortgang.md`](huishoek-voortgang.md)
     of `docs/plans/*`, status in §6 — herhaal een status niet in een tweede doc, dan kan er niets
     uiteenlopen.
   - **Bevestigd 🔧 → ✅ → archief.** Verplaats het naar
     [`huishoek-backlog-archief.md`](huishoek-backlog-archief.md) mét zijn notitie; laat geen ✅ in §6 staan.

> Dev-omgeving: `node:test` draait via `npm test`. Ontbreekt `@stryker-mutator/core` bij
> het mutatie-commando, draai dan eerst `npm ci` (mutatietesten zit in devDependencies).

## Mutanten snel doden — de terugkerende patronen

Een **overlevende** mutant = "een fout op deze regel laat géén test falen". Bekijk welke:
```bash
node scripts/mutation.mjs <module>    # bv. fairness — survivors landen in reports/mutation/mutation.json
```
De gaten die telkens terugkomen (assert dít, dan ben je meestal groen):

- **Grenswaarde** — test de exacte rand (`<` vs `<=`; "precies op de grens telt mee").
- **Volgorde** — assert de héle geordende lijst, inclusief de tie-break met *omgekeerde*
  invoer-volgorde (anders overleeft de sorteer-vergelijker: zijn tak wordt nooit geraakt).
- **Null / ontbrekend veld** — assert dat een ontbrekend veld → de fallback (`?? 0`), en
  dat het rekenteken klopt (`-` vs `+`: kies invoer waar de twee operanden verschillen).
- **Default-param** — roep de functie óók zónder argument aan (`fn()` → leeg/neutraal),
  anders overleeft de `arg = []`-default.
- **Equivalente mutant** — verandert het gedrag niet, dus onvangbaar (bv. een default die
  tóch dezelfde waarde teruggeeft, of optional chaining op iets dat nooit null is). Markeer
  met `// Stryker disable next-line all` of herijk de baseline. Mik op **~85 %, geen 100 %**.

Volledige uitleg, alle commando's en de baseline-workflow: [`docs/mutatietesten.md`](docs/mutatietesten.md).
