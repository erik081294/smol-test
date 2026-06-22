# Test-effectiviteit — mutatietest-rapport (2026-06-22)

## Samenvatting

De unit-tests **raken** veel code, maar **vangen** lang niet elke gedragsfout.

| Maat | Waarde | Wat het meet |
| --- | --- | --- |
| Regel-coverage | **92,6 %** | regels die tijdens een test worden uitgevoerd |
| Branch-coverage | **88,3 %** | takken die worden uitgevoerd |
| **Mutatie-score** | **74,2 %** | ingebrachte bugs die een test daadwerkelijk rood maakt |

Met andere woorden: ~92 % van de regels draait in een test, maar ongeveer **1 op de 4
bewust ingebrachte gedragsfouten glipt er ongemerkt doorheen** (860 van 3.339 mutanten
overleefden). Dat gat — tussen "uitgevoerd" en "geassert" — is precies wat dit rapport
in kaart brengt, per module en met concrete voorbeelden.

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
| 🔴 `supabase/functions/scan-receipt/core.js` | 53,3 % | 73/137 | 64 |
| 🔴 `lib/pantry.js` | 56,2 % | 68/121 | 53 |
| 🔴 `lib/cleaningTemplates.js` | 57,1 % | 60/105 | 45 |
| 🔴 `lib/notifications.js` | 59,7 % | 108/181 | 73 |
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
| 🟡 `lib/insights.js` | 83,5 % | 66/79 | 13 |
| 🟢 `lib/activity.js` | 86,5 % | 90/104 | 14 |
| 🟢 `lib/plantTimeline.js` | 87,5 % | 42/48 | 6 |
| 🟢 `lib/reservations.js` | 87,5 % | 49/56 | 7 |
| 🟢 `lib/plantPhoto.js` | 88,6 % | 39/44 | 5 |
| 🟢 `lib/visibility.js` | 88,9 % | 56/63 | 7 |
| 🟢 `lib/offCatalog.js` | 90,4 % | 85/94 | 9 |
| 🟢 `lib/rotation.js` | 92,3 % | 12/13 | 1 |
| 🟢 `lib/pendingDeletes.js` | 94,1 % | 16/17 | 1 |
| 🟢 `lib/barcode.js` | 97,1 % | 33/34 | 1 |
| 🟢 `lib/appRoute.js` | 100 % | 21/21 | 0 |
| 🟢 `lib/dataCache.js` | 100 % | 15/15 | 0 |
| **TOTAAL** | **74,2 %** | **2479/3339** | **860** |

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

1. **Grenswaarden vastpinnen in de vier rode modules** (`scan-receipt/core`, `pantry`,
   `cleaningTemplates`, `notifications`). Voeg per grens een test met de *exacte*
   randwaarde toe (verloopt-vandaag, hoeveelheid 0, eerste/laatste lus-iteratie). Dit
   doodt het leeuwendeel van de `EqualityOperator`- en lus-overlevers.
2. **Volgorde asserteren** waar de output een gesorteerde lijst is (notifications,
   recurrence, fairness, agenda): vervang `assert membership` door `assert.deepEqual` op
   de volledige, geordende lijst.
3. **Null-/ontbrekende-veld-paden toevoegen** voor records die uit de DB/AI komen
   (pantry-items zonder `best_before`/`low_threshold`, scan-receipt met afwijkende
   antwoordvorm).
4. **Negatieve guard-gevallen** toevoegen: lege input, ongeldige MIME, taak zonder
   datum — telkens de tak die nu ontbreekt.
5. **(Optioneel) een mutatie-drempel in CI** introduceren *nadat* de score is opgekrikt,
   bijv. `--break 70` per module, zodat regressies in test-effectiviteit zichtbaar
   worden. Bewust nu nog niet ingebouwd — eerst de basis verhogen.

Een gerichte ronde langs punten 1–4 voor alleen de vier rode modules tilt de
totaalscore naar schatting richting ~80 % en dicht de meest waarschijnlijke
"bug-glipt-door"-gevallen.

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
  Cijfers gemeten op 2026-06-22 (testsuite: 298 pass / 18 skip).
- Een **overlevende mutant is niet altijd een bug** — soms is het dode/equivalente code
  of bewust ongespecificeerd gedrag. De waarde zit in het *patroon*: structureel
  ongeteste grenzen, volgordes en null-paden.
