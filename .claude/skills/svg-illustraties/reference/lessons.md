# Geleerde lessen & werkende voorbeelden

Dit bestand groeit mee. Voeg een les toe zodra je iets ontdekt dat de set
consistenter/strakker maakt, of een patroon dat aantoonbaar goed werkt. Houd het
concreet: wat was het probleem, wat is de regel, en waarom.

---

## Pipeline & gereedschap

### L1 — JSX is geen SVG: render de échte component
De illustraties zijn `react-native-svg` JSX, geen `.svg`-bestanden. Je kunt ze
niet direct "bekijken". `scripts/svg-bundle.mjs` evalueert de bron met geshimde
imports (react-native-svg-primitieven → SVG-DOM-tags) en `render.mjs` rastert dat
met resvg. Zo beoordeel je exact wat de app toont, niet een handgekopieerde SVG
die kan afwijken.

### L2 — Preview == app alleen met string-`transform`
react-native-svg kent eigen transform-props (`scale`, `originX/Y`, `rotation`).
Die renderen **niet** in de SVG-DOM-preview (resvg negeert ze) → preview wijkt af
van de app. Gebruik altijd de string-vorm:
`transform="translate(60 87) scale(1.1) translate(-60 -87)"`. Die werkt identiek
in react-native-svg én in de preview. Schaal/roteer rond een expliciet punt met
de `translate(p) … translate(-p)`-sandwich.

### L3 — Sluit de lus altijd
Geen geometrie-wijziging zonder de nieuwe render terug te kijken. `--names <naam>`
houdt het herrenderen snel. Leg voor/na naast elkaar — pas dan is het oordeel
hard i.p.v. gevoel.

---

## Compositie & uitlijning

### L4 — Centreer op het visuele zwaartepunt, niet de boundingbox
Uitsteeksels trekken het gewicht opzij. Bij `today` duwt het oor (handvat) van de
mok het zwaartepunt naar rechts van het midden, ook al staat de mok-body op (60).
Bij `groceries` trekt de duwbeugel het topgewicht naar links. Corrigeer voor wat
het oog als "midden" leest, niet voor de geometrische box.

### L5 — Presence-pariteit: geen timide of dikke outlier
Op het contactvel moeten alle hoofdobjecten ongeveer even zwaar wegen (~55–65%
van de stage). `plants` was de outlier (te klein, veel loze ruimte bovenin). Fix:
~10% opschalen via een `<G>`-string-transform vanaf de **potbasis (60,87)** zodat
de plant op de grond-ellips blijft staan. Het zonnetje-accent bleef búiten de
`<G>` (het ankert op de stage, niet op de plant). Zie L6.

### L6 — Schaal vanaf het anker, en houd het accent erbuiten
De grond-ellips zit in `Stage` (wordt niet meegeschaald). Schaal een object dus
rond zijn contactpunt met de grond, niet rond (60,60), anders gaat het zweven of
zakken. Het speelse accent hoort lós: niet mee schalen/animeren.

---

## Schaduw, vorm & realisme

### L7 — Schaduw-systeem: zachte twee-laags contact-schaduw
De oude vaste grond-ellips (`cx60 cy92 rx26 opacity0.08`) las als een platte blob.
Vervangen door een `Shadow`-helper in `Stage` met een `shadow`-prop (footprint):
een brede lichte halo (`opacity 0.07`) + een smallere, iets donkerdere kern
(`opacity 0.10`). Dat geeft een zachte rand zonder SVG-blur (niet overal
ondersteund). Stem de footprint af op de objectbasis (`<Stage shadow={12}>` voor
een smalle pot, `18` voor de mok) zodat het object niet zweeft.

### L8 — Herkenbaarheid > abstractie (plant-herontwerp)
De oude plant was twee gespiegelde teardrops die samen een blob vormden + een
losse steel — las als een avocado, "best wel apart". Fix: een herkenbare scheut
met **drie aparte bladeren op steeltjes** die uit de aarde waaieren (midden
donker/voor, twee zij-bladeren zachter/achter). Les: een symmetrische blob leest
zelden als wat je bedoelt; aparte, duidelijke deelvormen wel. Hergebruik via een
`leaf(cx, by, ty, hw)`-helper (spitse lens) en roteer met een transform rond de
basis om ze te laten waaieren.

## Animatie

### L9 — Lichte animatie: entree overal (idle bewust niet)
Entree zit in de `Illustration`-API zelf: bij verschijnen veert 'ie zacht in beeld
(opacity + scale 0.92→1 + lift 8→0, `Animated.spring` friction 6 / tension 90).
Eén keer, subtiel, via `prefersReducedMotion()` (eindstand zonder animatie bij
"verminder beweging"). Dit is een gewone `Animated.View`-transform → Fabric-veilig
en op toestel geverifieerd. Idle-loops (loof wiegen, stoom krullen) zijn er
**bewust niet** — zie L11.

### L11 — Animeer GEEN react-native-svg `transform`-prop (crasht op Fabric)
Een idle die een `<G transform=…>` animeert via
`Animated.createAnimatedComponent(G)` + een geïnterpoleerde rotate-string crasht
op de nieuwe architectuur (Fabric):
`java.lang.ClassCastException: java.lang.String cannot be cast to …` in
`BaseViewManagerDelegate.setProperty`. Een *statische* string-`transform` is
prima; een *geanimeerde* transform-prop niet (de Animated-waarde komt als String
aan waar de view-manager een matrix/array verwacht). Op toestel gevangen via de
adb-route — niet zichtbaar in lint of de statische render. **Veilige idle-opties:**
(a) animeer de héle wrapper met een `Animated.View` (RN-View-transform = Fabric-OK,
maar beweegt stage+schaduw mee — geschikt voor een subtiele "ademhaling"), of
(b) gebruik `react-native-reanimated` (heeft echte Fabric-SVG-ondersteuning) voor
beweging op deel-elementen. Sub-element-idle via de ingebouwde `Animated` +
SVG-props: niet doen.

### L10 — Render-shim moet RN-API's dekken die de bron raakt
Toen `Illustration` `Animated` ging gebruiken en `./motion` importeerde, brak de
pipeline (`AccessibilityInfo`/`UIManager`/`LayoutAnimation` ontbraken in de shim;
`Animated` ontbrak). Opgelost in `svg-bundle.mjs`: `Animated.View`/`G` zijn
passthroughs en alle animatie-calls zijn no-ops, zodat de statische render altijd
de **eindstand** toont (de filmstrip toont de tussenstanden). Een geanimeerde
`transform`-prop → stub `interpolate` → genegeerd → object rendert in ruststand.
Les: groeit de bron, groeit de shim mee.

## Beoordeling van de set (bijgewerkt 2026-06-20)

Render: `render.mjs --grid`. Stand van zaken:

| illustratie | oordeel |
|-------------|---------|
| `tasks`     | sterk — exemplarische uitlijning (gedeelde vakje-geometrie, 12px-ritme) |
| `agenda`    | sterk — gecentreerd, rustig, gemarkeerde dag op het midden |
| `groups`    | sterk — vult de stage goed, mooi in balans |
| `plants`    | **herontworpen** → herkenbare scheut (L8) |
| `today`     | schaduw strakker (footprint 18, L7); let nog op rechts-zwaartepunt door het oor (L4) |
| `cleaning`  | goed; bewust diagonaal, accent balanceert rechts |
| `groceries` | goed; topgewicht leunt iets links door de duwbeugel (L4) |
| `expenses`  | bewust diagonaal/twee-foci — levendiger maar minder rustig dan de rest |

Set-breed toegepast: nieuwe contact-schaduw (L7) + entree-animatie (L9). Openstaande
kandidaten: `today` ~2px centreren (L4); `groceries` duwbeugel intrekken. Diagonale
composities (`expenses`, `cleaning`) zijn waarschijnlijk intentioneel — alleen na
akkoord aanpassen.
