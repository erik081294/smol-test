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
- **Design-systeem:** [`DESIGN.md`](DESIGN.md). **Overige naslag/how-to & gedateerde reviews:**
  [`docs/README.md`](docs/README.md).

Onderstaande **definition of done** borgt onze integratiesnelheid: testgaten horen dicht
vóór de PR, niet pas bij de merge. (Deze sessie kostte een half uur omdat een PR pas bij
de merge op de mutatie-ratchet zakte — dat voorkomen we hiermee.)

## Definition of done — vóór je een PR opent

1. **Raakte je een gemuteerde module? Draai de mutatie-ratchet en dicht 'm tot groen.**
   Gemuteerd = elk bronbestand in de `GROUPS`-lijst in
   [`scripts/mutation.mjs`](scripts/mutation.mjs) (de `lib/*.js` met een unit-test).
   ```bash
   node scripts/mutation-check.mjs --since=origin/main   # alleen je gewijzigde modules, ~1-2 min
   ```
   Dit is exact wat CI draait. Zakt een module onder zijn baseline, dicht het dan nú —
   niet ontdekken ná de merge.

2. **Elke nieuwe `export function` in `lib/*.js` krijgt een unit-test in dezelfde PR.**
   Geen losse functie zonder test mergen. Een test náást de functie vangt vrijwel de hele
   ratchet-daling af nog vóór de mutatietest eraan te pas komt — dit is de goedkoopste fix.

3. **Volledige suite groen:** `npm test`.

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
