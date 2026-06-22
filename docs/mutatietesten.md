# Mutatietesten & de effectiviteit-ratchet

Korte, praktische gids. Wil je de achtergrond en de cijfers per module? Zie
[`docs/test-effectiviteit-2026-06-22.md`](./test-effectiviteit-2026-06-22.md).

## Waarom

Regel-coverage zegt "deze regel is uitgevoerd". Het zegt **niet** of een test een
fout zou betrappen. Mutatietesten meet dat wél: het brengt kleine, realistische fouten
aan in de broncode (een **mutant** — bv. `<=` → `<`, een weggehaalde `.sort()`, een
guard die altijd `true` wordt) en kijkt of de tests rood worden.

- **Killed** — een test werd rood. Goed: die bug zou je vangen. ✅
- **Survived** — alle tests bleven groen. Een fout in die regel glipt er ongemerkt door. ❌

**Mutatie-score** = killed / (killed + survived). Het is onze échte maat voor
test-effectiviteit.

## Lokaal draaien

```bash
npm run test:mutation              # volledige scope (~10-15 min, 4 cores)
npm run test:mutation -- pantry    # alleen modules/tests waarvan de naam matcht (snel)
```

Output: een tabel (zwakste module eerst) + `reports/mutation/mutation.json` (ruwe data,
git-genegeerd). Om te zien wélke mutanten in een module overleven en op welke regel:

```bash
node scripts/mutation.mjs pantry   # draait alleen pantry
node -e '                          # toon de overlevers met regel + mutatie
  const r = require("./reports/mutation/mutation.json"), fs = require("fs");
  const f = "lib/pantry.js", src = fs.readFileSync(f, "utf8").split("\n");
  for (const m of r.files[f].mutants.filter(m => m.status === "Survived"))
    console.log(`L${m.location.start.line}`, m.mutatorName, "→", String(m.replacement).slice(0, 40), "|", src[m.location.start.line-1].trim());
'
```

Een overlever vertelt je precies welk gedrag níet wordt geasserteerd. De meest
voorkomende echte gaten: **grenswaarden** (test de exacte rand, niet alleen het midden),
**volgorde** (assert de hele geordende lijst, niet alleen lidmaatschap) en **null-/
ontbrekende-veld-paden**.

## De ratchet (CI)

De score per module ligt vast in [`mutation-baseline.json`](../mutation-baseline.json).
Op elke PR draait `.github/workflows/mutation.yml` de check **alleen voor de modules die
in die PR wijzigden** en faalt als hun score meer dan de tolerantie (standaard **1
procentpunt**) onder de baseline zakt.

```bash
npm run test:mutation:check                      # check alle modules tegen de baseline
node scripts/mutation-check.mjs --since=origin/main   # alleen wat sinds <ref> wijzigde (zoals CI)
```

### Minimaal tegen drempels aanlopen — zo werkt het in de praktijk

De ratchet is bewust **vriendelijk** opgezet:

- **Hij checkt alleen wat jij raakte.** Wijzig je `lib/pantry.js` niet, dan kan je PR
  ook nooit op pantry falen. Een groene `main` blijft dus groen voor niet-gerelateerd werk.
- **Hij faalt alleen bij een echte daling**, niet als de score gelijk blijft of stijgt.
- **De foutmelding zegt precies wat te doen** (zie hieronder).

Faalt de check, dan heb je drie opties:

1. **De daling is terecht een testgat** → voeg een test toe die het nieuwe gedrag
   vastpint. Draai `node scripts/mutation.mjs <module>` om te zien welke mutant overleeft.
   Dit is verreweg het meest voorkomende en gewenste geval.
2. **De overlever is een equivalente mutant** (verandert het gedrag niet, dus
   onvangbaar — bv. `x ?? d` → `x && d` waar een parameter-default `d` tóch teruggeeft).
   Markeer 'm in de bron met een Stryker-comment zodat hij niet meer meetelt:
   ```js
   // Stryker disable next-line all
   const time = prefs.time ?? '08:00';
   ```
   …of werk de baseline bij (optie 3) als markeren onpraktisch is.
3. **De daling is bewust** (je verwijderde geteste logica, of het is data/equivalent en
   je accepteert de nieuwe score) → herijk de baseline en commit 'm mee:
   ```bash
   npm run test:mutation:baseline
   git add mutation-baseline.json && git commit -m "chore: mutatie-baseline bijwerken"
   ```

> Vuistregel: **~85 % is een gezonde streefwaarde, geen 100 %.** Boven ~85 % jaag je
> vooral equivalente mutanten na met kunstmatige tests; dat maakt de suite slechter, niet
> beter. Dicht het *patroon* (grenzen, volgordes, null-paden), niet het laatste getal.

## Onderhoud

- **Nieuwe logica-module met tests toegevoegd?** Voeg een regel toe aan `GROUPS` in
  [`scripts/mutation.mjs`](../scripts/mutation.mjs) (`{ test: '<testnaam>', srcs: ['lib/<module>.js'] }`)
  en herijk de baseline (`npm run test:mutation:baseline`).
- **Pure datatabel** (alleen lookup-/vertaal-/stijldata, zoals `i18n`, `offCategoryMap`,
  `colorSchemes`)? Voeg `exclude: ['StringLiteral']` toe aan de groep — losse
  data-strings muteren meet geen logica en vertekent de score.
- **Niet in scope:** React-gekoppelde lagen (`lib/use*.js`, UI, schermen, componenten)
  worden niet gemuteerd (geen unit-tests), evenmin als de RLS-integratietest (vereist
  secrets). Wijzigingen daarin triggeren de ratchet dus niet.

## Hoe het technisch werkt (kort)

- Tool: [Stryker](https://stryker-mutator.io/) met de **command-runner**, zodat de
  bestaande `node:test`-opzet (incl. de eigen ESM-loader in `tests/register.mjs`)
  onveranderd blijft.
- Per module wordt alleen die module gemuteerd en alleen de bijbehorende testfile
  gedraaid → snel en met zuivere attributie.
- De Babel-parser-plugins staan expliciet op `["jsx"]` omdat `babel-preset-expo` de
  `decorators`-plugin aanzet (anders botst dat met Stryker's `decorators-legacy`).
- `coverageAnalysis` staat op `off` (de command-runner ondersteunt geen per-test-coverage).
