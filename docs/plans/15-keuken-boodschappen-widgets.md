# Plan 15 — Keuken-module, boodschappen-koppeling, week-swipe & rijke widgets

Eén samenhangende ronde (Erik, 2026-06-24). Doel: vier dingen die samen één logisch geheel
vormen rond eten/boodschappen + de Vandaag-widgets. Per onderdeel: pure logica + tests waar
het kan, mutatie-ratchet groen, lint schoon.

## 1 — Catalogus ⇄ boodschappenlijst koppelen (0-based stepper)
**Probleem:** de catalogus had "aantal kiezen → in winkelmand" met twee knoppen; verwarrend.

**Nieuw model (Picnic-achtig, één mechaniek):**
- Elke catalogus-rij heeft één stepper die **start op het huidige lijst-aantal** (0 als het er
  niet op staat). `min = 0`, géén losse add-knop meer.
  - `0 → 1/2/…` : zet (of werk bij) het item op de boodschappenlijst met dat aantal.
  - `→ 0` : haal het van de lijst (verwijderen).
- De **boodschappenlijst-rijen** krijgen exact dezelfde stepper. Catalogus en lijst zijn zo
  "gekoppeld": ze tonen/bewerken hetzelfde aantal, in dezelfde stijl.
- **Afvinken** = swipe (rechts) of tik op de rij. **Verwijderen** = swipe (links) óf het
  aantal op 0 zetten. Op 0 zetten telt dus als verwijderen, niet als afvinken.
- Optimistisch: het aantal verandert meteen lokaal (snappy), netwerk volgt.

**Bouw:**
- `useGroceries.setCount(name, count, { productId, unit })` — vindt de open regel op
  genormaliseerde naam; `count<=0` → remove, anders create/update (hergebruikt `mergeQuantity`
  niet — dit **zet** het aantal i.p.v. optellen). Koppelt aan product zodat recency vult.
- Pure helper `lib/groceryCount.js`: `countOf(items, name)` (open regel → aantal), getest.
- `catalog.js`: rij = beeld + naam + stepper(min 0, waarde = countOf). Geen cart-knop.
- `boodschappen.js`: lijstrij = checkbox + naam + zelfde compacte stepper (0 = verwijderen);
  swipe rechts = afvinken, links = verwijderen; tik = afvinken.

## 2 — Inline zoeken op de boodschappen-pagina (#5)
Tijdens typen in de toevoegbalk: een paar **mini catalogus-resultaatrijen** (beeld + naam +
stepper) onder de balk, plus twee UX-vriendelijke uitgangen:
- **"'<term>' toevoegen"** — eigen product (eenmalig), als de term geen exacte match is.
- **"Hele catalogus bekijken"** — opent `/catalog` (met de term voorgevuld).
Vervangt de losse product-hint-chips.

## 3 — Weekmenu: zijwaarts door de weken vegen (zoals Taken)
De maand/​week-swipe van Taken (`Gesture.Pan` + `activeOffsetX`/`failOffsetY` + slide-animatie,
`prefersReducedMotion`-bewust) overnemen op het weekmenu: vorige/volgende week met meeschuivende
content. De ‹ › knoppen blijven als betrouwbare bediening.

## 4 — Recepten + Weekmenu in een eigen "Keuken"-omgeving (#6)
**Nu:** weekmenu zit als module `maaltijden`, met de `EtenNav` (Boodschappen | Weekmenu).
Recepten hebben geen beheerscherm (alleen inline kiezen + `recipe/[id]` editor).

**Nieuw:**
- Module `maaltijden` → label **"Keuken"** (route blijft `maaltijden`; geen DB-/route-churn).
- In het scherm een **sub-nav (Weekmenu | Recepten)**:
  - *Weekmenu* = de planner (met week-swipe + "vul boodschappenlijst").
  - *Recepten* = beheerlijst: alle recepten (met coverfoto), nieuw recept, tik → editor.
- `EtenNav` vervalt (was nog net Boodschappen | Weekmenu): **Boodschappen wordt standalone**
  (de "uit recept → lijst"-flow blijft in het weekmenu). EtenNav verwijderen + uit voorraad.

## 5 — Rijke Vandaag-widgets (#2)
Widgets mogen de ruimte benutten i.p.v. tekstregels:
- **Maaltijden**: een **7-dagen-strip** (ma–zo), per dag een staat (gepland → maaltijd-stip,
  leeg → open), vandaag gemarkeerd. Stat = vanavond of "X dagen open".
- **Voorraad/Planten**: visuele accenten (status-stip per item, "volgende beurt").
- Overige (Taken/Boodschappen/Agenda/Activiteit) houden hun gestapelde lijst (al goed),
  lichte polish waar nodig.
Tegelhoogte blijft uniform; de strip is horizontaal en past binnen `TILE_H`.

## Verificatie
`npm test` groen · `node scripts/mutation-check.mjs --since=origin/main` groen (nieuwe pure
modules ≥ baseline) · `npx expo lint` 0 errors · rooktest op de moto voor de gebaren
(swipe-week, swipe-afvinken) — RNGH-pan is niet betrouwbaar in de emulator te injecteren.
