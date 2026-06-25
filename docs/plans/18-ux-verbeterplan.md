# 18 — Verbeterplan: usability, toegankelijkheid, correctheid & performance

> **Soort:** kwaliteit/UX · **Migratie:** nee · **Backlog-items:** A11Y-1/A11Y-2, UX-43, UX-44, PERF-9,
> INF-11, BOO-12 (§6); onderbouwing bij PERF-4 (D1/D4), PERF-5 (D2). Mapping per pijler hieronder.
>
> Verwerkt in de backlog op 2026-06-25. **Pijler D overlapt deels met de PERF-audit ([plan 16](./16-performance-audit.md)):**
> D1 = PERF-4, D2 = PERF-5; **D5 wordt bewust niet gedaan** (de PERF-audit beschouwt het rij-niveau als
> de juiste memo-grens, niet de losse primitieven).

## Context

Je vroeg om meerdere Opus-subagents die de app écht doorlichten, elk met een eigen
methodiek en aandachtsgebied, met als resultaat een concreet, op best practices gegrond
verbeterplan. Ik heb **4 Opus-subagents parallel** ingezet (allen read-only, want we
zaten in plan-modus):

1. **Usability** — heuristische evaluatie (Nielsen's 10) + cognitive walkthrough van de kernflows + mobiele platform-conventies (HIG/Material).
2. **Toegankelijkheid** — React Native a11y-API's + WCAG 2.2 vertaald naar mobiel.
3. **Logica/test/mutatie** — `npm test`, `npm run lint`, mutatie-ratchet; DoD-check uit CLAUDE.md.
4. **Performance** — render- & runtime-analyse op New Architecture/Fabric.

Daarna heb ik de belangrijkste bevindingen zelf in de echte code geverifieerd (file:line
hieronder kloppen met de huidige branch `feat/boodschappen-redesign`).

**Algemeen oordeel:** de app is in goede staat. Testsuite groen (**567 pass / 0 fail /
18 skip**, ~6,3 s), lint schoon op de logica-laag (27 warnings, allemaal React-hooks, geen
logica), mutatie-ratchet **groen**, en alle nieuwe pure `lib/*.js`-exports zijn getest
(geen DoD-schending). De onderstaande punten zijn dus **verbeteringen, geen brandjes**.
De grootste winst zit in **toegankelijkheid** (gebaar-only acties + ontbrekende live-region)
en een paar gerichte **performance-fixes** op de zwaarste lijsten.

---

## Pijler A — Toegankelijkheid (hoogste impact, laagste effort) → A11Y-1 / A11Y-2

Nulmeting (reproduceerbaar): 281 `onPress`, 151 `accessibilityLabel`, 77 `accessibilityRole`,
14 `accessibilityHint`, **0 `accessibilityActions`**, **0 `accessibilityRole="header"`**,
`allowFontScaling` nergens uitgezet (goed). De fundering in `lib/ui.js` is bewust
toegankelijk gebouwd; de gaten zijn geconcentreerd en grotendeels in de primitieven te
dichten — één fix daar werkt overal door.

### A1 (→ A11Y-1) — Swipe-acties onbereikbaar voor screenreaders (Hoog) · WCAG 2.5.1 / 2.1.1
`lib/ui.js:406-436` (`SwipeRow`) levert verwijderen/afvinken/uitstellen **uitsluitend** via
veeg-gestures. De docstring `lib/ui.js:373-375` belooft een zichtbare knop-fallback, maar
de consumers leveren die niet: `app/(tabs)/boodschappen.js:30-33` (verwijderen alléén swipe),
`app/(tabs)/vandaag.js:264-270`, `app/(tabs)/maaltijden.js:130,263`, `app/(tabs)/voorraad.js:118-119`.
- **Fix:** geef `SwipeRow` props `accessibilityActions` + `onAccessibilityAction` die
  `left.onTrigger`/`right.onTrigger` aanroepen, en zet ze door naar het kind. Eén fix in het
  primitief dekt alle 5 schermen.

### A2 (→ A11Y-1) — Toast/snackbar wordt niet voorgelezen (Hoog) · WCAG 4.1.3 Status Messages
`lib/toast.js:71-86` heeft geen `accessibilityLiveRegion` en doet geen announce. De toast
draagt vaak de énige bevestiging + de **"Ongedaan maken"**-actie (4 s venster, regel 56).
Geverifieerd: geen live-region aanwezig.
- **Fix:** `accessibilityLiveRegion="polite"` op de buitenste toast-`View` (Android) +
  `AccessibilityInfo.announceForAccessibility(message)` bij `show()` (iOS). Overweeg de
  4 s-duur te verlengen wanneer een screenreader actief is.

### A3 (→ A11Y-1) — `accessibilityRole="header"` ontbreekt overal (Midden) · RN rotor-navigatie
0 treffers. `ScreenHeader` (`lib/ui.js:645-655`), `SectionHeader` (`:592-601`) en
`ModalHeader` renderen koppen als kale `Text`. Screenreader-gebruikers kunnen niet per kop
navigeren. **Fix:** `accessibilityRole="header"` op de titel-`Text` in die drie primitieven.

### A4 (→ A11Y-1) — `Stepper` leest "Minder"/"Meer" zonder context of waarde (Midden) · RN `adjustable`
Geverifieerd `lib/ui.js:225,229`: hardgecodeerde NL-strings `'Minder'`/`'Meer'`, los van de
meegegeven `accessibilityLabel`; de waarde staat als losse `Text` (`:226`).
- **Fix:** maak de hele `Stepper` één `accessibilityRole="adjustable"` met
  `accessibilityValue={{min,max,now}}` + `onAccessibilityAction` voor increment/decrement,
  en vervang de hardgecodeerde strings door `t(...)`.

### A5 (→ A11Y-2) — Sub-44pt touch-targets (Midden) · WCAG 2.5.5 / HIG 44pt / Material 48dp
- `app/catalog.js:42-44` — prune-knop `28×36` (hitSlop 8 maakt 'm net ~44, breedte blijft krap). Geverifieerd.
- `app/expense/[id].js:232-235` — exact-bedrag-`TextInput` ~24px hoog **én zonder `accessibilityLabel`** (A6).
- `lib/ui.js` — `Chip` (`:454`) en `SegmentedControl` (`:626`) staan op `minHeight:38`; `SegmentedControl` heeft géén hitSlop.
- **Fix:** segment/chip naar `minHeight:44`; exact-split-input `minHeight: touchTarget`; prune-knop naar de gedeelde `IconButton` (48dp).

### A6 (→ A11Y-2) — Losse invoervelden zonder label (Midden) · WCAG 1.3.1/4.1.2
`app/expense/[id].js:232` exact-split-`TextInput` heeft alleen een placeholder. De gedeelde
`Field` (`lib/ui.js:238-263`) doet dit juist góéd. **Fix:** wikkel in `Field` met
`label={member.display_name}` of geef minstens `accessibilityLabel`.

### A7 (→ A11Y-2) — Kleur als enige informatiedrager: voorraad-status (Midden) · WCAG 1.4.1
`app/(tabs)/voorraad.js:121` toont status via een gekleurde stip; voor FRESH/zonder
houdbaarheidsdatum is er geen tekst-badge, en SOON/LOW delen dezelfde kleur.
- **Fix:** `accessibilityLabel` met statusnaam op de stip + status in de rij-`accessibilityLabel`; overweeg altijd een mini-badge.

### A8 (→ A11Y-2) — `VisibilityPicker` rauwe `TouchableOpacity` zonder a11y (Midden) · RN role/state
`lib/VisibilityPicker.js:74-83` (de enige `TouchableOpacity` in de codebase): geen
`accessibilityRole`/`-Label`/`-State`; selectie alleen via `opacity:0.45`.
- **Fix:** vervang door de bestaande `AvatarSelect`-primitief (`lib/ui.js:555-586`), die dit al goed doet.

### A9 (→ A11Y-2) — Long-press-verwijderen op tags niet ontdekbaar (Laag/Midden) · WCAG 2.5.1
`lib/TagPicker.js:38-40` (verwijderen op `Chip.onLongPress`). Heeft wél een hint, maar geen
toegankelijk alternatief. **Fix:** `accessibilityActions` op `Chip` wanneer `onLongPress`
aanwezig is, of verwijderen ook via menu aanbieden.

> **Al góéd (behouden):** echte WCAG-contrasttest (`tests/contrast.test.js`, beide thema's);
> reduce-motion consequent gerespecteerd (`lib/motion.js` + guards); decoratieve grafieken/
> illustraties correct verborgen; `Field`/`Button`/`Checkbox` dragen rol+label+state.

---

## Pijler B — Usability (Nielsen-heuristieken + cognitive walkthrough) → UX-43 / UX-44

De componentbasis is sterk en consistent; de risico's zitten in **ontdekbaarheid van
verborgen interacties** en een paar **conceptuele model-mismatches**.

### B1 (→ UX-43) — Swipe-richting is inconsistent tussen schermen (Hoog) · Nielsen #4 consistentie
Geverifieerd: op Boodschappen is links-vegen **verwijderen** (rood, `app/(tabs)/boodschappen.js:30-32`),
op Vandaag is links-vegen **uitstellen** (oker, `app/(tabs)/vandaag.js:266-267`). Rechts-vegen is
overal afvinken, maar dezelfde links-beweging is op het ene scherm destructief en op het andere
niet — én in tegenspraak met de docstring `lib/ui.js:368-370` ("links = verwijderen").
- **Fix:** leg één app-brede conventie vast (bv. rechts = positieve actie/afvinken; links =
  destructief), pas het afwijkende scherm aan, en documenteer het in DESIGN.md + de
  `SwipeRow`-comment.

### B2 (→ UX-43) — Verwijderen op de boodschappenlijst is volledig verborgen + zonder bevestiging (Hoog) · Nielsen #5/#6
Op een open boodschap is er **geen zichtbare verwijder-affordance**: het kan alléén via
swipe-links (`boodschappen.js:30-31`, geen statisch hint-icoon) óf door de stepper naar 0 te
tikken (`:48,168-172` — `min={0}`, `n<=0` → `removeWithUndo`). Een per-ongeluk-tik op de
compacte stepper (34dp, `lib/ui.js:204`) verwijdert meteen; het enige vangnet is de undo-toast
(4 s, `toast.js:56`). Dezelfde −knop betekent "minder" bij waarde 2 en "verwijderen" bij waarde 1
— visueel niet te onderscheiden.
- **Fix:** maak verwijderen ontdekbaar én legibel: zichtbare ingang (sluit aan op A1's
  `SwipeRow`-knop-fallback) en/of de −knop toont op waarde 1 een prullenbak-icoon. Borg een
  ruime, geteste undo-duur (B-link met A2).

### B3 (→ UX-44) — Widget-bewerkmodus is alleen via long-press-drag ontdekbaar (Midden/Hoog) · Nielsen #6
`app/(tabs)/vandaag.js:307-309`: slepen schakelt de bewerkmodus automatisch in, maar buiten die
modus is nergens zichtbaar dat tegels sleepbaar zijn; de "Aanpassen"-link staat onderaan achter
scrollen (`:327-335`). (Positief: de controlebalk-knoppen `:182-211` zijn een uitstekende
toegankelijke route náást de drag.)
- **Fix:** geef "Aanpassen" een prominente plek (potlood-`IconButton` in de `ScreenHeader`-right-slot,
  consistent met andere schermen) + een eenmalige hint dat tegels aanpasbaar zijn.

### B4 (→ UX-44) — "Eerder gekozen" ×-knop verbergt het product app-breed (Midden) · Nielsen #2 label↔effect
`app/catalog.js:131-141` (`pruneImpl`): de × roept `setHidden(id, true)` aan — dat verbergt het
product overal, terwijl het label `catalog.recent.remove` (`:43`) "uit recent verwijderen"
suggereert. Er is wél undo, maar belofte ≠ effect.
- **Fix:** microcopy verduidelijken ("Product verbergen") óf de actie écht tot het recent-lijstje
  beperken.

### B5 (→ UX-44) — Geen "klaar"-moment wanneer alles afgevinkt is (Midden) · Nielsen #1 zichtbaarheid status
`boodschappen.js:284-292`: `ListEmptyComponent` toont alleen iets bij `items.length===0`. Als alle
items afgevinkt zijn (`open` leeg, `done` gevuld) is er geen positieve bevestiging.
- **Fix:** bij `open.length===0 && done.length>0` een felicitatie/mini-empty tonen via de bestaande
  `Celebrate` (`lib/ui.js:983-1023`) of `Empty`.

### B6 (→ UX-44) — Inconsistente feedback-timing bij custom-item toevoegen (Midden) · Nielsen #1/#4
`app/catalog.js:148-156`: succes-toast wordt **vóór** de netwerkcall getoond (`:151`), gevolgd door
een error-dialog bij falen (`:155`) → tegenstrijdig. `boodschappen.js:124-132` doet het juist
**ná** succes (`:130`).
- **Fix:** één patroon kiezen (bij voorkeur optimistisch tonen + bij fout de toast vervangen door
  de error), beide schermen gelijktrekken.

### B7 (→ UX-44) — Stepper toont geen eenheid; "0 = eraf"-model niet uitgelegd (Midden) · Nielsen #2/#6
`boodschappen.js:47-50`: de trailing-stepper toont een kaal getal zonder eenheid (eenheid staat
apart in `meta`, en alleen wanneer afgevinkt, `:44`).
- **Fix:** `formatValue`-prop van `Stepper` (`lib/ui.js:193,226`) invullen met de eenheid; overweeg
  een eenmalige hint over het 0-betekent-eraf-model.

### B8 (→ UX-44) — Kleinere punten (Laag/Midden)
- **Suggesties niet wegklikbaar** (`boodschappen.js:241-267`) → klein ×/"niet nu" per kaart, zoals de
  catalogus-prune (Nielsen #3).
- **`RefreshControl refreshing={loading}`** (`boodschappen.js:274`, `vandaag.js:222`) koppelt de
  pull-spinner aan de algemene laadstatus → aparte `refreshing`-state voor user-pull (Nielsen #1).
- **Zoek-dropdown backdrop zonder dim** (`boodschappen.js:296-298`) → `colors.overlay` geven,
  consistent met `BottomSheet` (`lib/ui.js:832`), maakt de sluit-affordance ontdekbaar (Nielsen #8).
- **Bon-link visueel zwak + verdwijnt tijdens typen** (`boodschappen.js:229-236`) → stabielere plek
  (bv. `ScreenHeader`-right-slot) als bon-registratie belangrijk is.

> **Al góéd (behouden):** optimistische updates + lokale stepper-state (`lib/ui.js:196-199`);
> undo-toasts breed bij destructieve acties; skeleton/empty/banner-staten compleet
> (`boodschappen.js:284-292`, `vandaag.js:240-247`); discard-bevestiging incl. Android-back
> (`lib/ui.js:729-739`); a11y + reduce-motion by-default.

---

## Pijler C — Logica, testdekking & mutatie-robuustheid → INF-11 / BOO-12

**Suite:** `npm test` → 567 pass / 0 fail / 18 skip (~6,3 s, geen flakiness).
**Lint:** `npm run lint` → 0 errors, 27 warnings (14× `set-state-in-effect`, 12×
`exhaustive-deps`, 3× `static-components`) — allemaal in de React-laag, géén in `lib/*.js`.
**Mutatie:** `node scripts/mutation-check.mjs --since=origin/main` → **groen**, geen module
onder baseline; nieuwe modules scoren 92-100 %.
**DoD-check (CLAUDE.md):** geen schending — elke nieuwe pure export heeft een unit-test.

Concrete acties (klein, vóór PR):

### C1 (→ INF-11) — Mutatie-baseline bijwerken voor 5 nieuwe modules (procesrisico)
`scripts/mutation-check.mjs:102-103`: modules zónder baseline-entry worden alleen
gerapporteerd, nooit als regressie geteld. De 5 nieuwe modules (`groceryCatalog`,
`productImage`, `quantity`, `groceryCount`, `groceryList`, 92-100 %) kunnen de ratchet dus
niet laten falen tot de baseline staat.
- **Fix:** `npm run test:mutation:baseline` draaien zodat deze scores als floor vastliggen.

### C2 (→ BOO-12) — Decimale `parseQuantity`-input verliest de fractie (Laag, gedragsbug)
`lib/quantity.js:13-16`: `parseQuantity('2.5 kg')` → `{count:2, unit:'.5 kg'}`;
`mergeQuantity('2.5 kg','1 kg')` → `'3 .5 kg'`. Geen test dekt dit.
- **Fix:** beslis of decimale invoer ondersteund moet zijn; zo ja, regex + format aanpassen
  en een grens/round-trip-test toevoegen; zo nee, een test die het bedoelde (afgekapte)
  gedrag vastlegt. Equivalente mutant op `groceryList.js:12` (`'overig'`-fallback) eventueel
  met `// Stryker disable next-line StringLiteral` markeren.

---

## Pijler D — Performance (React Native / Fabric) → PERF-4 / PERF-5 / PERF-9

Architectuur is op de hoofdpunten gezond: lange lijsten gebruiken `SectionList`/`FlatList`
(geen `.map()` in `ScrollView`), zwaarste rijen zijn `React.memo`'d, worklets draaien op de
UI-thread, realtime-kanalen zijn gebundeld via een hub met nette cleanup.

### D1 (= PERF-4) — `TaskRow` niet gememoiseerd → hele takenlijst hertekent bij elke toggle (Midden)
Geverifieerd `lib/TaskRow.js:15` (geen `memo`) + per-render `members.find`/`taskTags`-bouw
(`:19,24-26`). Gebruikt in `taken.js:364-371`, `vandaag.js:263-271`, `schoonmaak.js:156`.
- **Fix:** `export const TaskRow = React.memo(function TaskRow(...))` + `useCallback` op
  `renderItem`/`onToggle` in die schermen. Goedkoopste merkbare winst op de Taken-tab.
  **Reeds gepland als PERF-4 (plan 16).**

### D2 (= PERF-5) — Voorraad "plaats"-view rendert alle rijen eager buiten virtualisatie (Hoog)
`app/(tabs)/voorraad.js:146,175-186`: `FlatList data={[]}` met alle secties+rijen in
`ListHeaderComponent` via `.map` → virtualisatie vervalt; alle `SwipeRow`'s tegelijk getekend.
- **Fix:** `SectionList` met echte `sections` (zelfde patroon als boodschappen/taken).
  **Reeds gepland als PERF-5 (plan 16).**

### D3 (→ PERF-9) — Virtualisatie-tuning ontbreekt op de SwipeRow-lijsten (Midden)
Alleen `app/catalog.js:216-219` zet `initialNumToRender`/`maxToRenderPerBatch`/`windowSize`/
`removeClippedSubviews`. `boodschappen.js:269`, `taken.js:345`, `kosten.js:89` missen ze.
- **Fix:** kopieer de afstelling van `catalog.js` (geen `getItemLayout`: rijhoogtes variëren).

### D4 (→ PERF-4, vouw in) — Home-dashboard mount N module-data-hooks tegelijk (Hoog, koude start)
`lib/widgets/registry.js`: elke widget roept zijn eigen hook aan (`:68 useGroceries`,
`:90 useExpenses`, `:106 usePlants`, `:153 useMealPlan`, `:197 usePantry`, `:231 useActivity`).
De hub bundelt kanalen, niet de initiële fetches → ~6-7 parallelle queries bij elke koude
start/huishouden-wissel.
- **Fix:** staggeren / prefetch-on-idle, of widgets data via een centrale loader voeden i.p.v.
  elk een eigen hook. Minimaal: `useMealPlan(new Date())` (`:153`) stabiliseren met een
  gememoiseerde datum (per-render `new Date()` triggert onnodige reloads). **Het minimale
  fixje is in PERF-4 gevouwen; de grotere stagger/loader is een optionele follow-up.**

### D5 (bewust NIET) — Lijst-primitieven memoiseren (Laag/Midden)
`ItemRow` (`lib/ui.js:298`), `Stepper` (`:193`), `Checkbox` (`:476`) zitten in élke lijstrij
maar zijn geen `memo`.
- **Beslissing (2026-06-25):** de PERF-audit (plan 16) beschouwt het **rij-niveau**
  (`GroceryRow`/`TaskRow`) als de juiste memo-grens; losse primitives memoïseren compliceert
  voor verwaarloosbare winst. **Niet doen** tenzij een meting anders wijst.

> **Al góéd (behouden):** gedeelde realtime-hub (1 kanaal i.p.v. N) met cleanup; incrementeel
> realtime-patchen + `dataCache`-seed; correcte UI-thread-worklets; `freezeOnBlur`+lazy tabs;
> LayoutAnimation correct gedempt op Fabric; theming zonder de Fabric-style-cache-valkuil.

---

## Voorgestelde volgorde (prioriteit)

De fixes clusteren rond een handvol gedeelde primitieven, dus per cluster één PR.

**P0 — interactie & a11y in de primitieven (1 PR, hoog rendement):** A1 (`SwipeRow`
accessibilityActions) + A2 (toast live-region) + A3 (header-rol) + A4 (`Stepper` adjustable),
samen met **B1** (swipe-richting uniformeren) en **B2** (verwijderen zichtbaar + legibel maken).
Deze raken dezelfde drie primitieven (`SwipeRow`, `Stepper`, toast); één doordachte fix per
primitief werkt over alle schermen door. → **A11Y-1 + UX-43**.

**P1 — performance op de zwaarste lijsten (1 PR):** D1 (`TaskRow` memo) + D2 (voorraad
`SectionList`) + D3 (virtualisatie-tuning). Merkbaar op een echt toestel. → **PERF-4 + PERF-5 + PERF-9**.

**P2 — usability quick wins (1 PR, klein, hoge duidelijkheidswinst):** B5 (klaar-moment via
`Celebrate`) + B6 (feedback-timing gelijktrekken) + B7 (eenheid in de stepper) + B8
(backdrop-dim, refresh-state, suggesties wegklikken) + B3 ("Aanpassen" prominenter) + B4
(prune-microcopy). → **UX-44**.

**P3 — afronding & hygiëne:** A5-A9 (touch-targets/labels/kleur-only/VisibilityPicker) +
C1 (mutatie-baseline) + C2 (decimale quantity) + D4/D5 (dashboard-fetches, primitieven-memo).
→ **A11Y-2 + INF-11 + BOO-12**.

Elke PR die een gemuteerde `lib/*.js`-module raakt: vóór de PR
`node scripts/mutation-check.mjs --since=origin/main` groen draaien (CLAUDE.md DoD).

---

## Verificatie

- **Logica/regressie:** `npm test` (verwacht ≥567 pass) en `npm run lint` na elke wijziging;
  `node scripts/mutation-check.mjs --since=origin/main` groen voor geraakte modules.
  (`node` via `export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"`.)
- **Toegankelijkheid:** VoiceOver (iOS) / TalkBack (Android) op een toestel — verifieer dat
  swipe-acties (A1) en de toast (A2) worden voorgelezen en bedienbaar zijn; rotor-kop-navigatie
  (A3); Stepper als adjustable (A4). Toestel-route uit projectgeheugen: USB + `adb reverse`.
- **Performance:** Taken- en Voorraad-tab met een gevulde lijst op een toestel; let op
  scroll-jank en re-render bij afvinken (D1/D2). Eventueel de RN-perfmonitor / Hermes-sampler.
- **Usability:** snelle hallway-test van de twee kernflows (boodschap via catalogus toevoegen
  → terugvinden; item afvinken/verwijderen) met de B1-fix erin.

---

## Status van de subagents

| Agent | Methodiek | Status |
|---|---|---|
| Usability | Nielsen + cognitive walkthrough | ✅ klaar — verwerkt in Pijler B |
| Toegankelijkheid | RN a11y + WCAG 2.2 | ✅ klaar — verwerkt in Pijler A |
| Logica/test/mutatie | node:test + Stryker + DoD | ✅ klaar — verwerkt in Pijler C |
| Performance | RN/Fabric render-analyse | ✅ klaar — verwerkt in Pijler D |
