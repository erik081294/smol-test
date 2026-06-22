# Test-effectiviteit — mutatietest-rapport (2026-06-22)

## Samenvatting

De unit-tests **raken** veel code, maar **vangen** lang niet elke gedragsfout.

| Maat | Waarde | Wat het meet |
| --- | --- | --- |
| Regel-coverage | **92,6 %** | regels die tijdens een test worden uitgevoerd |
| Branch-coverage | **88,3 %** | takken die worden uitgevoerd |
| **Mutatie-score** | **78,6 %** | ingebrachte bugs die een test daadwerkelijk rood maakt |

Met andere woorden: ~92 % van de regels draait in een test, maar ongeveer **1 op de 5
bewust ingebrachte gedragsfouten glipt er ongemerkt doorheen** (716 van 3.339 mutanten
overleefden). Dat gat — tussen "uitgevoerd" en "geassert" — is precies wat dit rapport
in kaart brengt, per module en met concrete voorbeelden.

> **Update 2026-06-22 (vervolgronde):** alle vier de rode modules zijn aangepakt —
> `pantry` (56,2 % → **83,5 %**), `notifications` (59,7 % → **85,1 %**),
> `scan-receipt/core` (53,3 % → **88,3 %**) en `cleaningTemplates` (57,1 % → **73,3 %**,
> logica ~99 %). De totaalscore ging van 74,2 % naar **78,6 %** en er zijn **geen rode
> modules meer**. Zie [§ Vervolgronde](#vervolgronde-gerichte-tests-op-de-rode-modules).

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

| Module | Score | killed/total | survived |
| --- | ---: | ---: | ---: |
| 🟠 `lib/recurrence.js` | 63,0 % | 63/100 | 37 |
| 🟠 `lib/navMeta.js` | 65,0 % | 13/20 | 7 |
| 🟠 `lib/expenses.js` | 65,7 % | 115/175 | 60 |
| 🟠 `lib/productMatch.js` | 67,3 % | 72/107 | 35 |
| 🟠 `lib/offCategoryMap.js` | 67,9 % | 53/78 | 25 |
| 🟠 `lib/widgets/summaries.js` | 69,1 % | 85/123 | 38 |
| 🟠 `lib/widgets/colorSchemes.js` | 69,2 % | 9/13 | 4 |
| 🟠 `lib/fairness.js` | 69,8 % | 44/63 | 19 |
| 🟠 `lib/choreLibrary.js` | 72,4 % | 105/145 | 40 |
| 🟠 `lib/decisions.js` | 73,1 % | 57/78 | 21 |
| 🟠 `lib/i18n.js` | 73,2 % | 30/41 | 11 |
| 🟠 `lib/cleaningTemplates.js` ⬆ | 73,3 % | 77/105 | 28 |
| 🟠 `lib/favoriteGroceries.js` | 73,9 % | 88/119 | 31 |
| 🟡 `lib/recurringExpense.js` | 75,0 % | 33/44 | 11 |
| 🟡 `lib/plantCare.js` | 76,0 % | 73/96 | 23 |
| 🟡 `lib/constants.js` | 77,3 % | 34/44 | 10 |
| 🟡 `lib/widgets/grid.js` | 77,3 % | 75/97 | 22 |
| 🟡 `lib/buyFrequency.js` | 78,8 % | 63/80 | 17 |
| 🟡 `lib/agenda.js` | 79,0 % | 162/205 | 43 |
| 🟡 `supabase/functions/notify/core.js` | 79,7 % | 55/69 | 14 |
| 🟡 `lib/offDelta.js` | 79,7 % | 59/74 | 15 |
| 🟡 `lib/priceTrack.js` | 81,3 % | 52/64 | 12 |
| 🟡 `lib/mealPlan.js` | 81,3 % | 61/75 | 14 |
| 🟡 `lib/modules.js` | 82,3 % | 158/192 | 34 |
| 🟡 `lib/realtimePatch.js` | 82,9 % | 87/105 | 18 |
| 🟡 `lib/pantry.js` ⬆ | 83,5 % | 101/121 | 20 |
| 🟡 `lib/insights.js` | 83,5 % | 66/79 | 13 |
| 🟢 `lib/notifications.js` ⬆ | 85,1 % | 154/181 | 27 |
| 🟢 `lib/activity.js` | 86,5 % | 90/104 | 14 |
| 🟢 `lib/plantTimeline.js` | 87,5 % | 42/48 | 6 |
| 🟢 `lib/reservations.js` | 87,5 % | 49/56 | 7 |
| 🟢 `supabase/functions/scan-receipt/core.js` ⬆ | 88,3 % | 121/137 | 16 |
| 🟢 `lib/plantPhoto.js` | 88,6 % | 39/44 | 5 |
| 🟢 `lib/visibility.js` | 88,9 % | 56/63 | 7 |
| 🟢 `lib/offCatalog.js` | 90,4 % | 85/94 | 9 |
| 🟢 `lib/rotation.js` | 92,3 % | 12/13 | 1 |
| 🟢 `lib/pendingDeletes.js` | 94,1 % | 16/17 | 1 |
| 🟢 `lib/barcode.js` | 97,1 % | 33/34 | 1 |
| 🟢 `lib/appRoute.js` | 100,0 % | 21/21 | 0 |
| 🟢 `lib/dataCache.js` | 100,0 % | 15/15 | 0 |
| **TOTAAL** | **78,6 %** | **2623/3339** | **716** |

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

1. ✅ **Alle vier de rode modules aangepakt** — `pantry`, `notifications`,
   `scan-receipt/core` en `cleaningTemplates` (zie § Vervolgronde). Er zijn **geen rode
   modules meer**; de zwakste zijn nu oranje.
2. **Volgende kandidaten** (oranje, echte logica-gaten, niet enkel datatabel): `recurrence`
   (63 %), `expenses` (65,7 %), `productMatch` (67,3 %), `fairness` (69,8 %),
   `choreLibrary` (72,4 %). Zelfde aanpak: grenswaarden, volgorde-asserties, null-paden.
3. **(Optioneel) een mutatie-drempel in CI** introduceren, bijv. een ratchet die de score
   niet mag laten dalen, zodat regressies in test-effectiviteit zichtbaar worden. Nu
   verantwoord om te overwegen omdat de basis op orde is.

Een vervolgronde langs de oranje modules tilt de totaalscore richting ~83 %; daarboven
domineren equivalente/datatabel-mutanten (zie *Methode & caveats*).

## Vervolgronde: gerichte tests op de rode modules

*(2026-06-22, na het eerste rapport.)* Alle vier de rode modules zijn aangepakt. Er is
**geen productiecode gewijzigd** — alleen tests toegevoegd — en na elke toevoeging is de
mutatie opnieuw gedraaid om de winst te bevestigen.

| Module | Vóór | Na | Δ | Nieuwe tests |
| --- | ---: | ---: | ---: | --- |
| `lib/pantry.js` | 56,2 % | **83,5 %** | +27,3 | +6 (`tests/pantry.test.js`) |
| `lib/notifications.js` | 59,7 % | **85,1 %** | +25,4 | +6 (`tests/notifications.test.js`) |
| `supabase/functions/scan-receipt/core.js` | 53,3 % | **88,3 %** | +35,0 | +8 (`tests/scanReceipt.test.js`) |
| `lib/cleaningTemplates.js` | 57,1 % | **73,3 %** | +16,2 | +6 (`tests/cleaningTemplates.test.js`) |

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
  Cijfers gemeten op 2026-06-22 (testsuite na de vervolgronde: 329 pass / 18 skip).
- Een **overlevende mutant is niet altijd een bug** — soms is het dode/equivalente code
  of bewust ongespecificeerd gedrag. De waarde zit in het *patroon*: structureel
  ongeteste grenzen, volgordes en null-paden.
