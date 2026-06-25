# 16 — Performance-audit & echte wins

> **Soort:** kwaliteit/perf · **Migratie:** deels (PERF-8) · **Backlog-items:** PERF-3 t/m PERF-8 (§6), onderbouwing bij PERF-1/PERF-2 en TKN-2.
>
> Dit document is **twee dingen tegelijk**: (1) het **volledige rapport** van een diepte-audit en
> (2) het **build-ready plan** per echte win. De audit is uitgevoerd door **5 parallelle Opus-subagents**,
> elk op een eigen performance-as, allemaal read-only. Datum: 2026-06-24.

## Hoe de audit is gedaan

Vijf agents, vijf onafhankelijke invalshoeken, elk met de opdracht "ga de diepte in, lees de
échte bestanden, en onderscheid een **echte win** (meetbaar, in een hot path, bij realistisch
datavolume) van **premature/micro-optimalisatie**":

| As | Scope | Kern-uitkomst |
|----|-------|---------------|
| **A. React-render** | schermen, hooks, `lib/ui.js`, widgets | `TaskRow` niet gememoiseerd → hele takenlijst hertekent per actie; Home-widgets idem; voorraad "plaats" buiten virtualisatie. |
| **B. Datalaag/netwerk** | `useCollection` + alle hooks, migraties, RPC's | `useProductFrequencies` ongelimiteerde + ongeïndexeerde full-table load; `usePurchases` zonder venster; `useNotifications` trekt 3 zware hooks app-breed. |
| **C. Compute (pure `lib/*`)** | i18n, groceryCatalog, productMatch, fairness, agenda, … | Fuzzy-matcher + catalogus-zoek her-normaliseren per keystroke/per render over hele lijsten. i18n (47KB) is **geen** probleem. |
| **D. Bundle/startup/assets** | imports, deps, Metro/Babel-config, eager graaf | **phosphor-react-native wordt volledig gebundeld** (~756 iconen voor ~57 gebruikte). Veruit de grootste enkele post. |
| **E. Animatie/UI-thread/gestures** | Reanimated, gestures, scroll, images | Foto's op volle resolutie in mini-thumbnails (geheugen/decode); voorraad "plaats" (consensus met A); heatmap = ~371 losse nodes. |

**Algemeen oordeel uit alle vijf:** het fundament is gezond. De gesture-/animatielaag is volwassen
(worklets op de UI-thread, hoofdlijsten gevirtualiseerd), `useCollection` is een solide SWR-primitief
met gedeelde realtime-hub, en de pure modules zijn algoritmisch in orde (O(n), voorgebouwde lookup-maps).
De winst zit in **een handvol scherp afgebakende plekken** — geen herarchitectuur nodig.

Alle hieronder geclaimde regels zijn **geverifieerd** tegen de bron (2026-06-24).

---

## Geprioriteerde samenvatting — de echte wins

Volgorde = effort/impact-verhouding (beste eerst). "Conv." = door meerdere agents onafhankelijk gevonden.

| # | Win | As | Impact | Insp. | Migr. | Conv. |
|---|-----|----|--------|-------|-------|-------|
| **PERF-3** | phosphor per-icoon importeren i.p.v. de barrel | D | **Hoog** | S | nee | — |
| **PERF-5** | voorraad "plaats"-modus terug onder virtualisatie | A+E | Midden | S | nee | **A+E** |
| **PERF-4** | `TaskRow` + Home-widgets memoïseren (render hot-path) | A | **Hoog** | M | nee | — |
| **PERF-6** | fuzzy-match & catalogus-zoek: per-keystroke normalisatie hoisten | C | **Hoog** | M | nee | — |
| **PERF-7** | foto's resizen bij upload + `expo-image`-cache | E | **Hoog** | M | nee | — |
| **PERF-8** | datalaag: query-vensters + koopfrequentie-RPC + reminder-hookstorm | B | Midden–Hoog | M | deels | — |

Daarnaast: de **heatmap → één SVG** is een echte node-reductie maar valt al onder **TKN-2** (zie onder),
en een aantal items is bewust **afgeraden** als premature optimalisatie (sectie "Bewust niet").

---

## PERF-3 — phosphor per-icoon importeren (de grootste enkele win)

**Bevinding (as D).** [lib/icons.js:13-34](../../lib/icons.js#L13) doet een **named import uit de
barrel** `phosphor-react-native`. Metro's `@expo/metro-config@56` heeft **geen tree-shaking** en
`inlineRequires: false`; named imports uit een barrel worden dus **niet** dood-gesnoeid. De barrel
(`node_modules/phosphor-react-native/.../index.js`, ~18.000 regels) `require()`t **alle 756 iconen**,
elk met de paden voor **6 gewichten** (defs ≈ 7,9 MB, componenten ≈ 5,9 MB op disk). De app gebruikt
feitelijk **~57 distinct iconen** (de `MAP` in `lib/icons.js`). Hermes parset + compileert die ~756
naar bytecode bij **elke koude start**; iconen zitten bovendien in de eager startup-graaf (tabbalk).

**Impact: Hoog.** Realistisch enkele honderden KB tot ~1 MB Hermes-bytecode + meetbare parse-/compile-tijd
per koude start. Grootste enkele post in de app; één bestand, laag risico.

**Plan.**
1. Vervang in [lib/icons.js](../../lib/icons.js) de barrel-import door **per-icoon subpath-imports** via
   het gepubliceerde `exports`-veld (`"./src/icons/*"` is expliciet beschikbaar — ondersteund, niet hacky):
   ```js
   import { House } from 'phosphor-react-native/src/icons/House';
   import { Sun }   from 'phosphor-react-native/src/icons/Sun';
   // … exact de ~57 iconen die de bestaande MAP gebruikt
   ```
   De `MAP` zelf blijft identiek; alleen de import-vorm verandert.
2. `lib/icons.js` is de **enige** plek die phosphor importeert (geverifieerd: 1 hit) → gecentraliseerde,
   laag-risico wijziging.
3. **Verifieer de winst meetbaar** vóór/na: bouw een release-bundle en vergelijk de bundle-grootte
   (bv. `npx expo export` → grootte van de JS-bundle), of meet koude-start TTI op toestel.

**Edge cases / let op.** Controleer dat elk icoon in de huidige `MAP` een bestaand subpath-bestand heeft
(phosphor exporteert per icoon-naam). Houd de `weight`/`size`-props identiek. Web (react-native-web) volgt
hetzelfde `exports`-veld — testen op web + native.

**Effort: S.** Geen migratie, geen test (geen pure-module-wijziging), wel een visuele rooktest dat alle
iconen nog renderen.

---

## PERF-5 — voorraad "plaats"-modus terug onder virtualisatie

**Bevinding (consensus as A én as E).** In [app/(tabs)/voorraad.js:146](../../app/(tabs)/voorraad.js#L146)
wordt in de plaats-weergave `listData = []` gezet en de **hele voorraad** in `ListHeaderComponent`
gerenderd via geneste `sections.map((s) => s.rows.map(renderRow))`
([:175-186](../../app/(tabs)/voorraad.js#L175)). De `FlatList` heeft dan 0 data-items → **virtualisatie
volledig uit**: élke rij (een `SwipeRow` met actieve Reanimated-Swipeable + meerdere `IconButton`s) mount
in één keer, en bij elke `adjustQuantity`/swipe hertekent de complete header-subtree. De urgentie-weergave
(de default) virtualiseert wél correct (`data={sorted}`) — dit is puur de plaats-modus.

**Impact: Midden.** Voorraad kan realistisch tientallen–honderd+ items zijn. Wisselen naar "plaats" geeft
een merkbare frame-hitch + zwaardere scroll; schaalt lineair met voorraadgrootte. Twee agents vonden dit
onafhankelijk → hoge zekerheid.

**Plan.**
1. Maak van de plaats-modus een **`SectionList`** (zoals [boodschappen.js](../../app/(tabs)/boodschappen.js)
   en [taken.js](../../app/(tabs)/taken.js) al doen): `sections = [{ loc, data: rows }]` met
   `renderSectionHeader` voor de locatienaam. Dan virtualiseren beide weergaven.
2. `renderRow` is al een losse functie → herbruikbaar als `renderItem`. Wikkel de rij-component in
   `React.memo` met stabiele callbacks (zelfde `useEvent`-patroon als `GroceryRow`).
3. Het dubbele-`.map()`-pad in `ListHeaderComponent` vervalt.

**Effort: S.** Geen migratie.

---

## PERF-4 — `TaskRow` + Home-widgets memoïseren (render hot-path)

**Bevinding (as A).** [lib/TaskRow.js:15](../../lib/TaskRow.js#L15) is een kale `export function`
**zonder `React.memo`**. In [taken.js](../../app/(tabs)/taken.js) staat `renderItem` bovendien inline in de
SectionList-prop ([:364-370](../../app/(tabs)/taken.js#L364)) en is `onToggle={toggle}` een vrije functie
die elke render opnieuw ontstaat ([:111](../../app/(tabs)/taken.js#L111)). Gevolg: **één afvink-actie (en
elke realtime-patch op `tasks`, elke veeg, elke filter/scope-wissel) hertekent álle zichtbare rijen**, niet
alleen de gewijzigde. Elke `TaskRow` rendert een meta-blok met ~10 conditionele children. Taken is hét
hot-path-scherm (20-60+ rijen, realtime + afvinken).

Hetzelfde geldt op **Home**: `WidgetGrid` geeft `tasks` door aan elke `descriptor.Render`
([WidgetGrid.js:152](../../lib/widgets/WidgetGrid.js#L152)); geen widget-component is gememoiseerd, dus
een `tasks`-patch hertekent **alle** tegels — óók `GroceriesCount`/`ExpensesBalance`/`PantryUrgent` die
`tasks` niet eens gebruiken.

> Het juiste patroon bestaat al: [boodschappen.js:27](../../app/(tabs)/boodschappen.js#L27) `GroceryRow`
> is `React.memo` met stabiele `useEvent`-callbacks ([:148](../../app/(tabs)/boodschappen.js#L148)) en een
> gememoiseerde `renderItem`. **Kopieer dit naar taken/vandaag.**

**Impact: Hoog** (taken) / **Midden–Hoog** (Home).

**Plan.**
1. `export const TaskRow = React.memo(function TaskRow(...))` in [lib/TaskRow.js](../../lib/TaskRow.js).
   `members`/`tags` zijn stabiel zolang het huishouden niet wijzigt → prima voor de memo-vergelijking.
2. In [taken.js](../../app/(tabs)/taken.js): trek `toggle`, `removeTaskWithUndo`, `snoozeTaskWithUndo`
   door het `useRef`+`useCallback`-useEvent-patroon en maak `renderItem` een `useCallback`. Idem voor de
   focuslijst in [vandaag.js:263-271](../../app/(tabs)/vandaag.js#L263).
3. Wikkel de widget-componenten (of minimaal `WidgetTile` in
   [lib/widgets/WidgetHost.js:20](../../lib/widgets/WidgetHost.js#L20)) in `React.memo`. De taak-afhankelijke
   tegels hertekenen terecht mee; de winst is dat de **niet**-taak-tegels stil blijven staan.

**Edge cases.** Let op dat `tasks` na een patch een nieuwe array-referentie is — taak-tegels en de takenlijst
hóren te hertekenen; de memo voorkomt alleen de *onnodige* hertekening van ongerelateerde rijen/tegels.

**Effort: M** (TaskRow-memo zelf is S; het stabiliseren van de callbacks in taken/vandaag is M).

---

## PERF-6 — fuzzy-match & catalogus-zoek: per-keystroke normalisatie hoisten

**Bevinding (as C).** Drie samenhangende plekken her-normaliseren statische/al-voorbewerkte data in een
hot path:

1. **`matchFor` in de render-body** van [app/purchase/[id].js:244](../../app/purchase/[id].js#L244):
   binnen `lines.map(...)` draait `matchFor(line.name)` → `bestMatch` → `suggestions(name, products)`
   **ongememoiseerd** → herhaalt bij **elke** state-change van het bon-editorscherm (elke toetsaanslag in
   elk veld). Kosten ≈ O(L · P · len) met L = bonregels, P = huishoud-producten (groeit onbeperkt).
2. **`productMatch.similarity`** ([lib/productMatch.js:31](../../lib/productMatch.js#L31)) normaliseert de
   **query opnieuw per product** (`normalize(a)` voor élk product i.p.v. 1×) en her-normaliseert de
   `p.search`-kolom die in de DB al genormaliseerd is opgeslagen ([useProducts.js:31](../../lib/useProducts.js#L31)).
   Draait per keystroke in voorraad-/recept-autocomplete én vermenigvuldigt punt 1.
3. **`groceryCatalog.searchCatalog`** ([lib/groceryCatalog.js:231](../../lib/groceryCatalog.js#L231))
   `normalize(it.name)` over alle ~110 statische catalogus-namen **per keystroke** — terwijl de module al
   een `ITEM_BY_NORM`-map heeft als precedent voor voorberekende genormaliseerde namen.

**Impact: Hoog** (punt 1, geneste loop × matcher per render) tot **Midden** (punt 3, vaste n=110 per keystroke).

**Plan.**
1. **Punt 1 (caller-fix, geen pure-module-wijziging → geen ratchet-risico):** haal de match-berekening uit
   de render-body. Leid de per-regel matches één keer af uit `lines` via `useMemo` (deps: `line.name` +
   `line.productId`).
2. **Punt 2 (pure module → mét unit-test):** in `suggestions` de query **één keer** normaliseren + de
   query-bigrams één keer bouwen, doorgeven aan een interne scorer. Vertrouw `p.search` als reeds
   genormaliseerd (skip `normalize` als `search` aanwezig is, val terug op `name`).
3. **Punt 3 (pure module → mét unit-test):** bouw op module-load `CATALOG_NORM = CATALOG.map(it => ({ it, norm: normalize(it.name) }))` (analoog aan `ITEM_BY_NORM`) en laat `searchCatalog` daarover `indexOf(q)` doen;
   alleen de query nog per call normaliseren. Voor meegegeven `items` (zelden) valt het terug op normaliseren.

**Mutatie-ratchet (CLAUDE.md/DoD).** `productMatch.js` en `groceryCatalog.js` zijn gemuteerde modules met
bestaande tests. Refactor met **gedrag identiek**: assert dat `suggestions` numeriek identiek scoort vóór/na
en dek de "`search` ontbreekt → fallback naar `name`"-tak; bevestig dat `searchCatalog` dezelfde
prefix-vs-midden-ordering geeft. Draai `node scripts/mutation-check.mjs --since=origin/main` tot groen.

**Effort: M** (punt 1 is S; punt 2/3 vragen gedragsbehoud + test).

---

## PERF-7 — foto's resizen bij upload + `expo-image`-cache

**Bevinding (as E).** [lib/photoPicker.js:10](../../lib/photoPicker.js#L10) comprimeert op kwaliteit
(`quality: 0.6`) maar **schaalt de pixelafmetingen niet** (geen `expo-image-manipulator`/resize — geverifieerd).
Een camerafoto blijft 2000-4000px breed (meerdere MB) en wordt via de **ingebouwde RN `<Image>`** (geen
`expo-image` in deps) in 56×56-thumbnails / 200px-kaarten getoond. RN-Image op Fabric heeft geen automatische
downsampling naar viewgrootte en geen persistente disk-cache → elke foto wordt op vol formaat naar een bitmap
gedecodeerd. Weergave-sites o.a. [maaltijden.js:270](../../app/(tabs)/maaltijden.js#L270),
[huisdieren.js:29](../../app/(tabs)/huisdieren.js#L29), [planten.js:29](../../app/(tabs)/planten.js#L29),
`pet/[id].js`, `plant/[id].js`, `recipe/[id].js`, `*/timeline.js`.

**Impact: Hoog.** Recepten-/dieren-/planten-lijsten met meerdere foto's → trage scroll + decode-hitches +
geheugendruk (op zwakkere Androids reëel GC-/OOM-risico). Schaalt met aantal foto-items in beeld.

**Plan.**
1. **Resize bij upload** (eenmalig, dekt alle foto-schermen want de picker is gedeeld): voeg in
   `pickImageAsset` na de pick een `ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1280 } }], { compress: 0.6 })` toe (`expo-image-manipulator` als dependency). Houd het `{uri,base64,ext}`-contract intact.
2. **`expo-image`** voor de signed-URL-thumbnails (disk-/memory-cache + automatische downsampling). Zet
   `recyclingKey={path}` zodat gerecyclede rijen in gevirtualiseerde lijsten niet de vorige foto tonen.
3. Voeg op [maaltijden.js:270](../../app/(tabs)/maaltijden.js#L270) een `contentFit`/`resizeMode` toe (ontbreekt
   daar, in tegenstelling tot de andere thumbnails).

**Edge cases.** `base64` wordt voor de upload gebruikt — na resize de base64 opnieuw uit het gemanipuleerde
bestand halen. Web-pad van `expo-image-manipulator` controleren. `expo-image` migratie incrementeel
(één gedeelde thumbnail-component).

**Effort: M** (resize-stap S; `expo-image`-migratie M).

---

## PERF-8 — datalaag: query-vensters, koopfrequentie-RPC & reminder-hookstorm

**Bevinding (as B).** Drie hooks doen buiten het gezonde `useCollection`-fundament om hun eigen, ongunstige
queries. Sluit aan op **PERF-1** (aggregaat-RPC's + `.limit(2000)`-venster) maar is daar niet in meegenomen.

1. **`useProductFrequencies` — ongelimiteerde + ongeïndexeerde full-table load op een hot scherm.**
   [lib/useProducts.js:87-92](../../lib/useProducts.js#L87) laadt **alle** `purchase_items` van het huishouden
   (embedded join naar `purchases(purchased_on)`) **zonder `.limit()`**, en mount op het Boodschappen-scherm
   ([boodschappen.js:60](../../app/(tabs)/boodschappen.js#L60)). `purchase_items` is een groeiende append-only
   log (wekelijks ~40 regels → na een jaar ~2000, daarna duizenden). Er is bovendien **geen index op
   `purchase_items(household_id)`** (bestaand: `(product_id, created_at)`, `(purchase_id)`) → seq scan op de
   WHERE `household_id = ... AND product_id is not null`. **Impact: Hoog.**
   **Fix:** een `stable security invoker` RPC `household_buy_frequencies(p_household)` die per `product_id`
   het mediaan-koopinterval server-side teruggeeft (zoals PERF-1's `household_*_totals`) → ~1 rij per product
   i.p.v. duizenden bonregels. Minimaal: index `purchase_items(household_id, product_id)` + een datumvenster
   (laatste ~18 maanden). **Migratie nodig.**
2. **`usePurchases` — geen laad-venster.** [lib/usePurchases.js:24-39](../../lib/usePurchases.js#L24) laadt
   `purchases` mét `*, purchase_items(*)` voor het hele huishouden **zonder `.limit()`** (anders dan
   `useExpenses`/`useTaskCompletions` die een 2000-venster hebben). Zwaarste payload (kop + alle regels), en
   elke realtime-mutatie triggert een **volledige refetch**. **Impact: Midden–Hoog** bij gevorderde huishoudens.
   **Fix:** geef het hetzelfde venster (`.order('purchased_on', desc).limit(PURCHASE_WINDOW)`; de index
   `purchases(household_id, purchased_on desc)` ondersteunt dit). Overweeg lazy regels (lijst = alleen kop;
   `purchase_items` pas in detailscherm). **Geen migratie.**
3. **`useNotifications` trekt 3 zware hooks app-breed.** [lib/useNotifications.js:19-23](../../lib/useNotifications.js#L19)
   mount `useTasks()` + `useMealPlan()` + `usePantry()` — elk een eigen fetch + subscription — puur om lokale
   reminders te herplannen, **app-breed zodra je ingelogd bent**, óók op schermen waar ze niet getoond worden.
   `useTasks` haalt bovendien de zwaardere zone-join op. De gedeelde realtime-hub (INF-8/C4) dempt het
   *kanaal*-aantal, maar de **mount-fetches** zijn echt dubbel. Bovendien doet de reminder-herberekening bij
   elke datawijziging `cancelAllScheduledNotificationsAsync` + tot ~60 `scheduleNotificationAsync`-calls.
   **Impact: Midden** (verraderlijk: onzichtbaar in de UI). **Fix:** een lichter `useTasksForReminders`
   (alleen `due_date/recur_*/title`, geen zone-join) + de herberekening debouncen/throttlen. **Geen migratie.**

**Plan.** Bouw in deze volgorde (oplopend in kosten): (2) `usePurchases`-venster [S] → (3) reminder-hookstorm
[M] → (1) koopfrequentie-RPC + index [S–M, migratie]. Bevestig dat **P-H4** (bulk-RPC bon→voorraad, al onder
PERF-1) hier los van staat maar dezelfde RPC-stijl deelt.

**Effort: M** (gespreid). Deels migratie.

---

## Onderbouwing bij bestaande items (niet dupliceren)

- **TKN-2 (activiteit-heatmap).** Twee agents (A+E) bevestigen: [lib/YearHeatmapView.js:108-122](../../lib/YearHeatmapView.js#L108)
  rendert een heel jaar als **~371 losse `View`/`Pressable`-nodes** (53×7) in een horizontale `ScrollView`,
  niet gevirtualiseerd. Eenmalige mount-hitch + zwaardere scroll. Dit is precies de "rendering+scroll op
  toestel bevestigen"-rest van TKN-2. **Fix als het jankt:** render het raster als **één `react-native-svg`
  `<Svg>`** met `<Rect>`-cellen (svg is hier al huisstijl: Sparkline/ProgressRing), tik-detectie via één
  `onPress` + coördinaat→cel (geometrie is uniform). De `ramp`/kleur-cache is al correct
  ([:33-36](../../lib/YearHeatmapView.js#L33)). → toegevoegd aan de TKN-2-notitie, géén aparte rij.
- **PERF-1 / P-H4.** `restockFromPurchase` ([lib/usePantry.js:41-61](../../lib/usePantry.js#L41)) doet N
  aparte round-trips + N realtime-echo's (tot ~30 writes per bon). Bevestigd & gekwantificeerd; al gepland
  als P-H4 onder PERF-1.

---

## Bewust NIET aanpakken (afgeraden als premature optimalisatie)

De agents markeerden deze expliciet als micro/equivalent — **niet** in de backlog, om dichtslibben te voorkomen:

- **`lib/ui.js` (54KB) splitsen voor render-perf** — nul effect op renders (elk component heeft eigen
  render-grenzen). Eén deel-win bestaat wél: `SplashWait` uit `ui.js` lichten zodat `app/_layout.js` niet het
  hele bestand + svg/gesture/reanimated eager binnentrekt voor een wachtscherm (as D, S). Klein; alleen meenemen
  als je toch in `_layout.js` zit.
- **`HouseholdProvider` context-value memoïseren** ([household.js:231-241](../../lib/household.js#L231)) —
  geen hot path (wijzigt alleen bij huishouden-wissel/module-toggle, niet bij scrollen/typen). Premature.
- **Losse primitives (`ItemRow`/`Checkbox`/`Badge`) memoïseren** — het rij-niveau (`GroceryRow`/`TaskRow`)
  is de juiste memo-grens; primitives los memoïseren compliceert voor verwaarloosbare winst.
- **WidgetGrid drag-`setState` / edge-auto-scroll `setInterval(16)`** — al afgeschermd met een `lastTarget`-guard;
  bij ≤8 widgets soepel. Niet preventief aanpakken; eerst op toestel meten.
- **i18n (47KB)** — één plat `DICT`-objectliteral, `t()` = O(1) map-lookup, geen werk op load. **Geen probleem.**
- **date-fns** — imports zijn al correct granulair (named per functie). Geen actie.
- **`Checkbox`/`Celebrate`/`ListSkeleton`-animaties** — legacy `Animated` mét `useNativeDriver` aan → UI-thread,
  geen JS-jank. In orde.
- **`insights`/`priceTrack`/`exactMatch`/`groupGroceriesByCategory`** — kleine n en/of al `useMemo`'d; samenvoegen
  levert hooguit een paar ms bij zelden-renderende schermen. `insights` sluit sowieso aan op PERF-1 (aggregaat-RPC).

---

## Wat al goed zit (bevestigd door de audit)

`useCollection` als SWR-primitief (household-gescopet, gedeelde realtime-hub C4, incrementeel patchen C3 voor
platte selects, cache per `(tabel, huishouden)`); optimistische hot actions (boodschap afvinken, taak voltooien);
hoofdlijsten gevirtualiseerd (`SectionList`/`FlatList` met getunede `initialNumToRender`/`windowSize`); gestures
op worklets (SwipeRow, BottomSheet, WidgetGrid-drag, PeriodPicker-swipe); `LayoutAnimation` correct uitgeschakeld
op Fabric ([motion.js:19-22](../../lib/motion.js#L19)); de dark-mode/Fabric-style-cache-aanpak (verse `type`/
`categoryMeta`-identiteit per `applyTheme` + root-remount); polyfills/lazy-`require` voor optionele native modules;
date-fns granulair; pure modules O(n) met voorgebouwde lookup-maps.

---

## Meet-discipline (geldt voor alle items)

Performance-claims worden **gemeten**, niet aangenomen:
- **Bundle/startup (PERF-3, SplashWait):** bundle-grootte vóór/na (`npx expo export`) + koude-start TTI op toestel.
- **Render (PERF-4, PERF-5):** React DevTools Profiler / `react-native` perf-monitor; tel re-renders vóór/na bij
  één afvink-actie en bij het wisselen naar voorraad-"plaats".
- **Compute (PERF-6):** micro-benchmark in een node-test (aantal `normalize`-calls vóór/na) + de mutatie-ratchet.
- **Datalaag (PERF-8):** `explain analyze` op de live DB (of de DB-advisor uit INF-10) + payload-grootte van de
  Boodschappen-/Bonnen-fetch vóór/na.
- **Foto's (PERF-7):** geheugengebruik (Android Studio profiler) bij een fotorijke lijst + scroll-fps.

Toestel-meten verloopt via de werkende USB+adb-route (zie projectgeheugen); web als snelle fallback voor
render-/bundle-checks.
