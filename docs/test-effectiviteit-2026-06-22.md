# Test-effectiviteit — mutatietest-rapport (2026-06-22)

> **Gedateerde momentopname (2026-06-22) — geen statustracker.** De cijfers en de
> modulelijst hieronder zijn bevroren op de meetdatum (40 modules, 84,9 %, 3381 mutanten).
> De suite is sindsdien gegroeid (o.a. de voertuig-/geld-laag, `formValidation`, en
> tijdzone-hardening). **De actuele, levende cijfers staan in
> [`mutation-baseline.json`](../mutation-baseline.json)**; de praktische gids is
> [`mutatietesten.md`](./mutatietesten.md). Lees dit document voor de *analyse en de patronen*
> (grenswaarden, volgorde, null-paden), niet voor het huidige getal per module.

## Samenvatting

De unit-tests **raken** veel code, maar **vangen** lang niet elke gedragsfout.

| Maat | Waarde | Wat het meet |
| --- | --- | --- |
| Regel-coverage | **92,6 %** | regels die tijdens een test worden uitgevoerd |
| Branch-coverage | **88,3 %** | takken die worden uitgevoerd |
| **Mutatie-score** | **84,9 %** | ingebrachte bugs die een test daadwerkelijk rood maakt |

Met andere woorden: ~92 % van de regels draait in een test. Bij de eerste meting glipte
**1 op de 4** ingebrachte gedragsfouten er ongemerkt doorheen; na de vervolgrondes is dat
nog **ongeveer 1 op de 7** (511 van 3.381 mutanten overleven, grotendeels equivalent of
datatabel — zie *Methode & caveats*). Dat gat — tussen "uitgevoerd" en "geassert" — is
precies wat dit rapport in kaart brengt, per module en met concrete voorbeelden.

> **Update 2026-06-22 (vervolgrondes):** de zwakke modules zijn in meerdere rondes
> aangepakt — eerst de vier rode (`pantry`, `notifications`, `scan-receipt/core`,
> `cleaningTemplates`), daarna de oranje en de gele met losse logica-gaten (o.a.
> `recurrence` 63→**91 %**, `recurringExpense` 75→**93 %**, `realtimePatch` 83→**97 %**,
> `mealPlan` 81→**92 %**, `priceTrack` 81→**91 %**, `buyFrequency` 79→**94 %**,
> `agenda` 79→**90 %**, `expenses` 66→**81 %**, `fairness` 70→**86 %**, `decisions`
> 73→**86 %**, e.v.a.). De totaalscore ging van 74,2 % → **84,9 %**; er zijn **geen rode
> modules meer** en het overgrote deel zit op 🟢 ≥ 85 %. Sinds deze ronde bewaakt een
> **CI-ratchet** ([`docs/mutatietesten.md`](./mutatietesten.md)) dat de score niet meer
> wegzakt (en is de volledige run ~28 % sneller via een gedeelde V8 compile-cache).
> Zie [§ Vervolgronde](#vervolgronde-gerichte-tests-op-de-rode-modules).

> Scope: de 40 pure, (vrijwel) dep-loze logica-modules onder `lib/`, `lib/widgets/` en de
> `core.js`-schillen van de Edge Functions — alles met een bijbehorende unit-test. De
> React-gekoppelde lagen (`lib/use*.js`, UI, schermen, componenten) en de RLS-
> integratietest vallen buiten scope (zie *Methode & caveats*).

## Wat is mutatietesten?

Een mutatietester brengt één voor één kleine, realistische fouten aan in de broncode
(een "mutant"), bijvoorbeeld `<=` → `<`, een guard die altijd `true` wordt, of een
weggehaalde `.sort(...)`. Daarna draait hij de tests:

- **Killed** — minstens één test werd rood. De testsuite ving de bug. ✅
- **Survived** — alle tests bleven groen. De bug zou ongemerkt in productie komen. ❌

De **mutatie-score** = killed / (killed + survived). Hoog = de tests asserteren echt
gedrag; laag = de tests draaien de code wel, maar controleren de uitkomst onvoldoende.

## Hoe het hier draait

```bash
npm run test:mutation            # volledige scope (~10-13 min)
npm run test:mutation -- pantry  # alleen modules/tests waarvan de naam matcht
```

De driver staat in [`scripts/mutation.mjs`](../scripts/mutation.mjs) en gebruikt
[Stryker](https://stryker-mutator.io/) met de **command-runner**, zodat de bestaande
`node:test`-opzet (inclusief de eigen ESM-loader in `tests/register.mjs`) ongewijzigd
blijft. Per logica-module wordt **alleen die module** gemuteerd en **alleen de
bijbehorende testfile** gedraaid — dat is snel én geeft zuivere attributie ("hoe goed
vangt test X bugs in module X"). Resultaten landen in `reports/mutation/mutation.json`
(git-genegeerd; regenereerbaar).

## Resultaat per module (zwakste eerst)

🔴 < 60 % · 🟠 60–75 % · 🟡 75–85 % · 🟢 ≥ 85 %

⬆ = opgekrikt in een vervolgronde (zie onder). De getoonde scores zijn de huidige
baseline ([`mutation-baseline.json`](../mutation-baseline.json)).

| Module | Score | killed/total | survived |
| --- | ---: | ---: | ---: |
| 🟠 `lib/navMeta.js` | 65,0 % | 13/20 | 7 |
| 🟠 `lib/offCategoryMap.js` | 67,9 % | 53/78 | 25 |
| 🟠 `lib/widgets/colorSchemes.js` | 69,2 % | 9/13 | 4 |
| 🟠 `lib/i18n.js` | 73,2 % | 30/41 | 11 |
| 🟠 `lib/cleaningTemplates.js` ⬆ | 73,3 % | 77/105 | 28 |
| 🟡 `lib/choreLibrary.js` ⬆ | 75,9 % | 110/145 | 35 |
| 🟡 `lib/constants.js` | 77,3 % | 34/44 | 10 |
| 🟡 `lib/widgets/grid.js` ⬆ | 77,3 % | 75/97 | 22 |
| 🟡 `lib/productMatch.js` ⬆ | 77,6 % | 83/107 | 24 |
| 🟡 `supabase/functions/notify/core.js` | 79,7 % | 55/69 | 14 |
| 🟡 `lib/widgets/summaries.js` ⬆ | 80,0 % | 132/165 | 33 |
| 🟡 `lib/expenses.js` ⬆ | 81,1 % | 142/175 | 33 |
| 🟡 `lib/favoriteGroceries.js` ⬆ | 81,5 % | 97/119 | 22 |
| 🟡 `lib/pantry.js` ⬆ | 83,5 % | 101/121 | 20 |
| 🟡 `lib/plantCare.js` ⬆ | 84,4 % | 81/96 | 15 |
| 🟢 `lib/notifications.js` ⬆ | 85,1 % | 154/181 | 27 |
| 🟢 `lib/fairness.js` ⬆ | 85,7 % | 54/63 | 9 |
| 🟢 `lib/decisions.js` ⬆ | 85,9 % | 67/78 | 11 |
| 🟢 `lib/activity.js` | 86,5 % | 90/104 | 14 |
| 🟢 `lib/offDelta.js` ⬆ | 86,5 % | 64/74 | 10 |
| 🟢 `lib/plantTimeline.js` | 87,5 % | 42/48 | 6 |
| 🟢 `lib/reservations.js` | 87,5 % | 49/56 | 7 |
| 🟢 `supabase/functions/scan-receipt/core.js` ⬆ | 88,3 % | 121/137 | 16 |
| 🟢 `lib/modules.js` ⬆ | 88,5 % | 170/192 | 22 |
| 🟢 `lib/insights.js` ⬆ | 88,6 % | 70/79 | 9 |
| 🟢 `lib/plantPhoto.js` | 88,6 % | 39/44 | 5 |
| 🟢 `lib/visibility.js` | 88,9 % | 56/63 | 7 |
| 🟢 `lib/agenda.js` ⬆ | 89,8 % | 184/205 | 21 |
| 🟢 `lib/offCatalog.js` | 90,4 % | 85/94 | 9 |
| 🟢 `lib/priceTrack.js` ⬆ | 90,6 % | 58/64 | 6 |
| 🟢 `lib/recurrence.js` ⬆ | 91,0 % | 91/100 | 9 |
| 🟢 `lib/mealPlan.js` ⬆ | 92,0 % | 69/75 | 6 |
| 🟢 `lib/rotation.js` | 92,3 % | 12/13 | 1 |
| 🟢 `lib/recurringExpense.js` ⬆ | 93,2 % | 41/44 | 3 |
| 🟢 `lib/buyFrequency.js` ⬆ | 93,8 % | 75/80 | 5 |
| 🟢 `lib/pendingDeletes.js` | 94,1 % | 16/17 | 1 |
| 🟢 `lib/barcode.js` | 97,1 % | 33/34 | 1 |
| 🟢 `lib/realtimePatch.js` ⬆ | 97,1 % | 102/105 | 3 |
| 🟢 `lib/appRoute.js` | 100,0 % | 21/21 | 0 |
| 🟢 `lib/dataCache.js` | 100,0 % | 15/15 | 0 |
| **TOTAAL** | **84,9 %** | **2870/3381** | **511** |

> ⬆ = aangepakt in de vervolgronde (zie onder).

## Terugkerende patronen in de overlevers

De overlevende mutanten zijn niet willekeurig verspreid — ze clusteren rond vier soorten
gedrag dat de tests wél uitvoeren maar niet asserteren. Aanpakken van deze patronen
levert de meeste effectiviteit per geschreven test op.

### 1. Grenswaarden (boundaries) — `EqualityOperator`: 82 overlevers

Tests gebruiken vaak "ruime" waarden in plaats van de exacte grens, dus `<=` → `<`
(en `===` → `>=`) overleeft.

- `lib/pantry.js:27` — `if (days != null && days <= soonDays) return SOON` → `days < soonDays`
  overleeft. **Een item dat exact op de drempeldag verloopt wordt niet getest.**
- `lib/pantry.js:54` — `if (remaining > 0)` → `remaining >= 0` overleeft (rest-hoeveelheid
  precies 0 niet geasserteerd).
- `lib/expenses.js:30` — `if (totalW <= 0)` → `totalW < 0` overleeft (gewicht exact 0).
- `lib/recurrence.js:20` / `lib/cleaningTemplates.js:48` / `lib/productMatch.js:22` —
  lus-grenzen (`i < n` → `i <= n`) overleven: de laatste iteratie wordt niet vastgepind.

### 2. Sortering/volgorde wordt niet geasserteerd — `MethodExpression`/`ArithmeticOperator`/`ArrowFunction`

Tests controleren *welke* elementen er zijn, niet de *volgorde*. Daardoor overleeft het
volledig weghalen of omdraaien van een comparator.

- `lib/notifications.js:36` — `out.sort((a, b) => a.fireAt - b.fireAt)`: zowel `out` (sort
  weg) als `a.fireAt + b.fireAt` (richting om) overleven. **De chronologische volgorde van
  herinneringen wordt nergens vastgelegd.**
- `lib/recurrence.js:18` — `[...recur_weekdays].sort((a,b)=>a-b)` → sort weg / `a+b`
  overleeft (gesorteerde weekdagen niet geasserteerd).
- `lib/fairness.js:54` — de stabiele tie-break op `profileId` bij gelijke `count`
  overleeft volledig (zie de 19 overlevers daar).

### 3. Nullish-/optional-fallbacks niet uitgeoefend — `OptionalChaining`: 40, deel van `LogicalOperator`: 67

Paden voor `null`/`undefined`/ontbrekende velden worden niet getest, dus `a?.b` → `a.b`
en `x ?? y` → `x` overleven.

- `supabase/functions/scan-receipt/core.js:26` — `d?.choices?.[0]?.message ?? d?.message ?? d`:
  meerdere optional-chaining- en `??`-mutanten overleven; de fallback-vormen van het
  AI-antwoord worden niet afgedekt.
- `lib/pantry.js:25,28` — `item?.best_before` / `item?.low_threshold` → niet-optionele
  variant overleeft (item zonder die velden niet getest).

### 4. Guard-clauses / vroege returns half getest — `ConditionalExpression`: 197

De grootste categorie: een guard wordt vervangen door `true` of `false` en overleeft,
omdat maar één van de twee takken in een test voorkomt.

- `supabase/functions/scan-receipt/core.js:11,19` — de MIME-/`data:`-validatie wordt
  geforceerd naar `true` zonder dat een test faalt (ongeldige input niet afgedekt).
- `lib/notifications.js:10` — `if (!task.due_date) return null` → `false`: het pad "taak
  zonder datum" wordt niet vastgepind.
- `lib/expenses.js:18` — `if (participants.length === 0) return {}` → `false` overleeft
  (lege deelnemerslijst niet getest).

## Aanbevolen vervolgstappen (grootste effect eerst)

1. ✅ **Rode, oranje én gele modules met losse logica-gaten aangepakt** (zie § Vervolgronde)
   — totaal 74,2 % → **84,9 %**, **geen rode modules meer**; het overgrote deel zit 🟢 ≥ 85 %.
2. ✅ **CI-ratchet actief** — `.github/workflows/mutation.yml` + [`docs/mutatietesten.md`](./mutatietesten.md)
   bewaken dat de score per gewijzigde module niet meer onder de baseline zakt. De
   volledige run is ~28 % sneller via een gedeelde V8 compile-cache (zie § Snelheid in
   die doc).
3. **Resterende ruimte (klein, optioneel)** zit nog in `widgets/summaries`, `productMatch`,
   `expenses` en `favoriteGroceries` (elk ~22–33 overlevers, grotendeels equivalent of
   datatabel) en in de bewust-niet-aangepakte datatabellen (`navMeta`, `offCategoryMap`,
   `i18n`, `colorSchemes`). Daar domineren equivalente/datatabel-mutanten — een hogere
   totaalscore najagen levert weinig echte bug-bescherming meer op.

## Vervolgronde: gerichte tests op de rode, oranje én gele modules

*(2026-06-22, na het eerste rapport, in meerdere rondes.)* **Geen productiecode
gewijzigd** — alleen tests toegevoegd — en na elke toevoeging is de mutatie opnieuw
gedraaid om de winst te bevestigen.

| Module | Vóór | Na | Δ |
| --- | ---: | ---: | ---: |
| `supabase/functions/scan-receipt/core.js` | 53,3 % | **88,3 %** | +35,0 |
| `lib/recurrence.js` | 63,0 % | **91,0 %** | +28,0 |
| `lib/pantry.js` | 56,2 % | **83,5 %** | +27,3 |
| `lib/notifications.js` | 59,7 % | **85,1 %** | +25,4 |
| `lib/recurringExpense.js` | 75,0 % | **93,2 %** | +18,2 |
| `lib/fairness.js` | 69,8 % | **85,7 %** | +15,9 |
| `lib/expenses.js` | 65,7 % | **81,1 %** | +15,4 |
| `lib/buyFrequency.js` | 78,8 % | **93,8 %** | +15,0 |
| `lib/realtimePatch.js` | 82,9 % | **97,1 %** | +14,2 |
| `lib/decisions.js` | 73,1 % | **85,9 %** | +12,8 |
| `lib/agenda.js` | 79,0 % | **89,8 %** | +10,8 |
| `lib/mealPlan.js` | 81,3 % | **92,0 %** | +10,7 |
| `lib/productMatch.js` | 67,3 % | **77,6 %** | +10,3 |
| `lib/priceTrack.js` | 81,3 % | **90,6 %** | +9,3 |
| `lib/plantCare.js` | 76,0 % | **84,4 %** | +8,4 |
| `lib/widgets/summaries.js` | 69,1 % | **80,0 %** | +10,9 |
| `lib/favoriteGroceries.js` | 73,9 % | **81,5 %** | +7,6 |
| `lib/offDelta.js` | 79,7 % | **86,5 %** | +6,8 |
| `lib/modules.js` | 82,3 % | **88,5 %** | +6,2 |
| `lib/insights.js` | 83,5 % | **88,6 %** | +5,1 |
| `lib/cleaningTemplates.js` | 57,1 % | **73,3 %** | +16,2 (logica ~99 %) |
| `lib/choreLibrary.js` | 72,4 % | **75,9 %** | +3,5 (rest = load-validatie + datatabel) |

> Twee modules zijn data-/load-gedrukt: bij `cleaningTemplates` zitten 27 van de 28
> resterende overlevers in de `CLEANING_TEMPLATES`-tabel (logica-score ~99 %); bij
> `choreLibrary` is de rest de import-tijd-validatielus + de bibliotheek-data. Bij
> `scan-receipt` was de grootste winst het testen van de tot dan toe volledig ongeteste
> `extractText` (alle antwoordvormen van de LLM-gateway + null-elementen).

> `cleaningTemplates` is data-gedrukt: 27 van de 28 resterende overlevers zitten in de
> `CLEANING_TEMPLATES`-tabel (zonenamen/emoji's/titels). De *logica* in die module scoort
> ~99 % (77 van 78 logica-mutanten gedood; de enige overlever, `toLowerCase`→`toUpperCase`,
> is equivalent omdat beide kanten van de vergelijking gelijk genormaliseerd worden).
> Voor `scan-receipt` was de grootste winst het testen van de tot dan toe volledig
> ongeteste `extractText` (alle antwoordvormen van de LLM-gateway + null-elementen).

Wat de nieuwe tests vastpinnen (precies de patronen uit dit rapport):

- **Grenswaarden:** item dat *exact* op `soonDays` verloopt, hoeveelheid gelijk aan de
  drempel, rest precies 0, en `fireAt`/diner-tijd precies gelijk aan "nu".
- **Volgorde:** `assert.deepEqual` op de volledige, chronologisch geordende lijst
  (i.p.v. alleen lidmaatschap) — doodt het "`.sort()` mag weg / omgedraaid"-patroon. Voor
  de urgentie-sortering met bewust *tegen de datum in lopende namen*, zodat de datum-tie-
  break niet door de naamsortering wordt gemaskeerd, en met beide invoervolgordes zodat de
  comparator in béide richtingen wordt aangeroepen.
- **Null-/Date-/ontbrekende velden:** `daysUntil` met een `Date`-object, `status(null)`,
  pantry-items zonder datum/drempel, taken met een ongeldige datum.
- **Pref-gates & parsing:** voltooide taken eruit, voorraad-pref uit ⇒ geen alert, en de
  tijd-parsing met een niet-nul minuut (`08:15`).

**Plafond per module.** De resterende overlevers zijn grotendeels *equivalente* mutanten,
niet te doden zónder kunstmatige tests:

- De `PANTRY_STATUS`-enum-strings (`'vers'`, `'bijna-op'`, …): tests vergelijken tegen
  diezelfde constante, dus een gemuteerde waarde breekt de vergelijking niet — principieel
  onvangbaar (~12 overlevers in `pantry`).
- `if (days != null && days < 0)` → `if (true && days < 0)`: equivalent, want `null < 0`
  is sowieso `false`.
- `Number.isNaN(+at)` → `Number.isNaN(-at)`: `+x` en `-x` zijn beide `NaN` of beide niet.
- `prefs.x ?? '16:30'` → `prefs.x && '16:30'`: de functie-parameter heeft dezelfde default,
  die `undefined` alsnog opvangt.

Dit illustreert het algemene punt: ~100 % mutatie-score is geen doel — het *patroon*
dichten (grenzen, volgordes, null-paden) is dat wel.

## Methode & caveats

- **Tool:** Stryker 9.6.1, command-runner, `coverageAnalysis: "off"`. Babel-parser-
  plugins zijn expliciet op `["jsx"]` gezet omdat `babel-preset-expo` de `decorators`-
  plugin aanzet, wat anders botst met Stryker's `decorators-legacy`.
- **Datatabellen.** `lib/i18n.js` (vertalingen), `lib/offCategoryMap.js` (token-regels)
  en `lib/widgets/colorSchemes.js` (kleur/stijl) zijn lookup-/datatabellen. Daar zijn
  `StringLiteral`-mutaties uitgesloten: ze muteren losse datawaarden, niet logica, en
  zouden de score vertekenen (ruw scoorde `offCategoryMap` 21,6 % puur door ~225
  string-token-mutanten). De gerapporteerde scores meten de *logica* in die modules.
- **Buiten scope:** React-gekoppelde modules zonder unit-test (zouden alleen "survived"
  ruis geven) en de RLS-integratietest (vereist secrets/egress).
- **Reproduceren:** `npm run test:mutation`; ruwe data in `reports/mutation/mutation.json`.
  Cijfers gemeten op 2026-06-22 (testsuite na de vervolgrondes: 421 pass / 18 skip).
  De per-module baseline staat in `mutation-baseline.json`; de CI-ratchet bewaakt 'm
  (zie `docs/mutatietesten.md`).
- Een **overlevende mutant is niet altijd een bug** — soms is het dode/equivalente code
  of bewust ongespecificeerd gedrag. De waarde zit in het *patroon*: structureel
  ongeteste grenzen, volgordes en null-paden.
