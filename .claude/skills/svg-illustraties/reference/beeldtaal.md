# Beeldtaal — de regels die de illustratie-set samenbinden

Eén beeldtaal voor álle lege schermen, zoals `lib/icons.js` dat is voor iconen en
`lib/theme.js` voor kleur. Een scherm verzint geen eigen tekening; het vraagt er
één op semantische naam: `<Illustration name="groceries" />`.

## Canvas & Stage
- **Vierkant canvas 120×120**, gecentreerde compositie, ruime witruimte.
- Vaste ronde **stage**: `<Circle cx=60 cy=60 r=50 fill={colors.forestTint} />`.
- **Contact-schaduw** onder élk object — hét visuele anker dat de set samenbindt.
  `Stage` tekent 'm automatisch via de `shadow`-prop (footprint-breedte, default
  22). Het is een zachte twee-laags ellips (brede lichte halo + smallere kern),
  géén harde blob en géén SVG-blur (dat wordt niet overal ondersteund). Stem de
  footprint af op de objectbasis: `<Stage shadow={12}>` voor een smalle pot,
  `<Stage shadow={0}>` om 'm uit te zetten.
- Gebruik de gedeelde `Stage`-component; teken nooit je eigen achtergrond of
  schaduw.

## Compositie
- **Eén hoofdobject** dat ~55–65% van de stage vult, gecentreerd op (60,60).
  Let op het *visuele* zwaartepunt: uitsteeksels (oor van een mok, duwbeugel van
  een kar) trekken het gewicht opzij — corrigeer daarvoor, niet voor de kale
  boundingbox.
- **Eén speels accent** (blad, vonk, stip, hartje), lós van het hoofdobject en
  gepositioneerd t.o.v. de stage (vaak rechtsboven). Het accent schaalt/animeert
  niet mee met het hoofdobject.
- Simpel, speels, functioneel — niet rond/rommelig.

## Vorm & stijl
- Plat en geometrisch. **Géén outlines**, op een enkel functioneel lijntje na
  (een steel, een €-teken, een vinkje).
- Ronde hoeken (`rx`) in de geest van `radius.*` uit het thema.
- Lijnen: `strokeLinecap="round"` / `strokeLinejoin="round"` voor zachte uiteinden.

## Palet (max ~4 tinten per beeld, alle uit `lib/theme.js`)
| token        | hex       | rol in illustraties                         |
|--------------|-----------|---------------------------------------------|
| `forest`     | `#0E3A2F` | donker hoofdvlak, lijnen, contrast          |
| `forestSoft` | `#1C5446` | lichter groen accentvlak                    |
| `forestTint` | `#E4ECE6` | de stage-achtergrond (vast)                 |
| `ocher`      | `#E0A53D` | warm hoofd-accent (objecten, FAB-sfeer)     |
| `ocherSoft`  | `#F6E4BE` | zachte ocher-vulling                        |
| `done`       | `#7BA893` | zachtgroen — secundair vlak / speels accent |
| `surface`    | `#FFFFFF` | "papier" (kaart, blad, klembord)            |
| `line`       | `#E2DDD2` | dunne randen / placeholder-streepjes        |

## Uitlijning (de discipline die het strak maakt)
Delen die hetzelfde "zijn", krijgen exact dezelfde geometrie zodat hun randen
pixel-op-pixel liggen. Voorbeeld uit `Tasks`: alle drie de checkbox-vakjes delen
`x=46, 10×10, rx=3, strokeWidth=2` — óók het afgevinkte (met stroke in zijn eigen
kleur) — en de regels staan op een vast 12px-ritme, verticaal gecentreerd t.o.v.
hun vakje. Gebruik gedeelde constanten (`const rows = [48,60,72]`) i.p.v. losse
magische getallen wanneer iets zich herhaalt.

## Een nieuwe illustratie toevoegen
1. Lees deze beeldtaal en bekijk 2–3 bestaande illustraties als ijkpunt.
2. Schrijf een component die `Stage` gebruikt en bovenstaande regels volgt.
3. Registreer 'm in `MAP` in `lib/illustrations.js` op een semantische naam.
4. Render + beoordeel (zie [SKILL.md](../SKILL.md)) en stel bij tot 'ie qua
   presence/centrering matcht met de set op het contactvel.
