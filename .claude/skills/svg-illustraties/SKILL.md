---
name: svg-illustraties
description: Tekenen, beoordelen, optimaliseren en animeren van de react-native-svg illustraties van Huishoek (lib/illustrations.js). Gebruik deze skill wanneer je een illustratie/lege-staat-tekening wilt toevoegen of verbeteren, wanneer je een SVG/illustratie visueel wilt bekijken of uitlijnen, of wanneer je een subtiele animatie (entree/loop) voor een illustratie wilt ontwerpen. Trefwoorden: SVG, illustratie, lege staat, empty state, beeldtaal, uitlijnen, animatie.
---

# SVG-illustraties: tekenen → beoordelen → optimaliseren → animeren

De illustraties van Huishoek zijn **`react-native-svg` JSX-componenten** in
[lib/illustrations.js](../../../lib/illustrations.js), géén losse `.svg`-bestanden.
Ze delen één beeldtaal (de `Stage`, een 120×120 canvas, max ~4 tinten uit het
palet). Deze skill geeft je een werkende lus om ze te **zien** (renderen naar
PNG), te **beoordelen** (visueel + op uitlijning), te **verbeteren** en te
**animeren** — en om de geleerde lessen vast te leggen zodat de set consistent
blijft.

> **Kernidee:** je kunt JSX niet "bekijken". Daarom rendert deze skill de échte
> component naar een PNG die je daarna met Read visueel beoordeelt. Wat je ziet
> is exact wat de app toont (zelfde bron, 1-op-1 primitieven).

## Setup (eenmalig, of als `node_modules` ontbreekt)

Node staat hier niet op de default PATH; prefix met nvm. Installeer de rasterizer
in de skill-map (dit raakt de project-deps niet aan):

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
cd .claude/skills/svg-illustraties/scripts && npm install
```

`react`, `react-dom` en `@babel/*` worden geleend uit de project-`node_modules`;
alleen `@resvg/resvg-js` is een eigen dep van de skill. Uitvoer komt in
`.claude/skills/svg-illustraties/.out/` (niet committen — staat in `.gitignore`).

## De werklus

Werk altijd vanaf de project-root, met de PATH-prefix actief.

### 1. Beoordelen — render en kijk
```bash
node .claude/skills/svg-illustraties/scripts/render.mjs --grid
```
Maakt `.out/<naam>.png` per illustratie + `.out/_contactvel.png` (overzicht).
`--grid` legt een 10px-raster + rode middenlijnen (60,60) over elk vak — dé
manier om centrering en uitlijning te beoordelen. Lees daarna het contactvel met
de Read-tool en beoordeel het als ontwerper (zie checklist hieronder).

Opties: `--names today,plants` (selectie), `--scale 6` (scherper losse PNG's),
`--only-sheet`, `--no-sheet`.

### 2. Optimaliseren — pas de bron aan, herrender, verifieer
Wijzig de component in `lib/illustrations.js`, render opnieuw met `--names <naam>`
en lees de PNG terug. **Sluit de lus altijd**: nooit een geometrie-wijziging
zonder de nieuwe render te hebben bekeken. Voor- en ná naast elkaar leggen maakt
het oordeel hard.

### 3. Animeren — ontwerp de beweging, beoordeel als filmstrip
```bash
node .claude/skills/svg-illustraties/scripts/filmstrip.mjs plants --type entrance
```
Rendert de keyframes naast elkaar (`.out/_filmstrip-<naam>-<type>.png`) zodat je
de tussenstanden/timing kunt beoordelen vóór je het in reanimated giet. Types:
`entrance` (opveren + infaden), `pulse`, `sway`. Vertaal daarna naar een echte
in-app animatie volgens [reference/animation.md](reference/animation.md)
(react-native-svg ondersteunt géén SMIL/`<animate>` — animeren gebeurt met
reanimated/Animated op de wrapper).

### 4. Vastleggen — leer de set bij
Nieuwe les of mooi werkend voorbeeld? Schrijf het op in
[reference/lessons.md](reference/lessons.md). Dat is wat deze skill door de tijd
heen slimmer maakt.

## Beoordelings-checklist

- **Centrering** — staat het zwaartepunt (incl. uitsteeksels zoals oren/handvat)
  op de rode middenlijn, niet alleen de boundingbox?
- **Presence** — vult het hoofdobject ~55–65% van de stage? Vergelijk op het
  contactvel: geen enkele illustratie mag opvallend timide of dik zijn.
- **Anker** — staat alles op de grond-ellips? Het accent (stip/vonk) hoort lós
  van het hoofdobject, gepositioneerd t.o.v. de stage.
- **Uitlijning** — delen die hetzelfde "zijn" (vakjes, regels, wielen) delen
  exact dezelfde geometrie zodat hun randen pixel-op-pixel liggen.
- **Palet & tinten** — max ~4 tinten, allemaal uit `lib/theme.js`. Geen losse
  outlines (op een functioneel lijntje na).

## Referenties
- [reference/beeldtaal.md](reference/beeldtaal.md) — de regels die de set
  samenbinden (canvas, Stage, palet, compositie). Lees dit vóór je tekent.
- [reference/lessons.md](reference/lessons.md) — geleerde lessen + werkende
  voorbeelden. Groeit mee.
- [reference/animation.md](reference/animation.md) — reanimated-recepten voor
  in-app animatie + de filmstrip-preview-techniek.

## Belangrijk
- **Eén bron van waarheid:** wijzig nooit een gerenderde PNG; wijzig de component
  en herrender.
- **Preview == app:** gebruik string-`transform` (`transform="translate(..) scale(..)"`)
  i.p.v. react-native-svg's eigen `scale`/`originX`-props — alleen de string-vorm
  rendert identiek in zowel de app als deze preview-pipeline.
- **Decoratief:** illustraties zijn `accessibilityElementsHidden`; de
  Empty-titel/subtitel dragen de betekenis. Animaties mogen subtiel zijn en horen
  `prefers-reduced-motion`/Reduce Motion te respecteren.
