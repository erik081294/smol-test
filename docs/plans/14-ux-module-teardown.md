# Plan 14 — Module-voor-module UX-ontleding (Fase 1.6 "van half naar af")

**Backlog:** UXR-1 t/m UXR-8 (verkennend) + UX-15 t/m UX-20 (voor de hand liggend).
**Soort:** UX-diepgang — geen nieuwe datalaag, geen migratie. Leunt volledig op het
bestaande design-systeem (`lib/theme.js`, `lib/ui.js`, `DESIGN.md`).
**Verhouding tot Fase 1.5 (plan 07):** plan 07 maakte de app *visueel cohesief* (tokens,
componenten, optimistic/haptics/toast). Deze ronde gaat een laag dieper: per module
nagaan of de **flow af is** — niet "ziet het er goed uit", maar "kun je hier het hele
klusje klaren zonder dood te lopen". Veel modules hebben een dragende datalaag maar een
**halve interactie-laag** (data tonen ≠ kunnen handelen).

## Waarom deze ronde

De modules voelen "half af": de happy path bestaat, maar de randen niet. Terugkerende
patronen uit de UX-review:

- **States ontbreken** — geen laad-skeleton, een doodlopende lege staat, of geen zichtbare
  foutstaat. De gebruiker ziet een leeg scherm en weet niet of het laadt, leeg is, of stuk.
- **Data zonder handeling** — een detail-/kaartscherm toont iets (volgende waterbeurt,
  verzorgingskaart, ingrediënten, eerstvolgende dierzorg) maar je kunt er niet *op
  handelen* (afvinken, bewerken, plannen) zonder een omweg.
- **Inconsistente bediening** — verwijderen is in de ene module een undo-toast, in de
  andere een long-press, in de derde een modal. Bulk-acties ("clear done", "verwijder
  verlopen") bestaan in de ene module wel en de andere niet.
- **Onduidelijke beslismomenten** — microcopy die een keuze niet uitlegt (rotatie-volgorde,
  split-type, welke periode de eerlijkheid/inzichten telt, "settle"-suggesties).

Dit zijn geen bugs; het zijn ontbrekende stappen die samen het "half"-gevoel geven.

---

## De ontleed-lens — drie passes per module

Elke teardown-sessie loopt één module-familie langs in drie passes. Leg per pass de
bevindingen vast als **concrete §6-rijen** (een nieuwe `UX-NN`, of een module-prefix-rij);
de UXR-rij zelf is de *sessie*, niet de oplossing.

### 1. Scherm voor scherm
Voor élk scherm in de module (lijst, detail, editor, sheet):

- **5-seconden-test** — open het scherm koud: weet je binnen 2s wat dit scherm is en wat
  de eerstvolgende actie is? (`DESIGN.md` principe 1.)
- **De vier states** — bestaat er een nette **loading** (skeleton, niet blanco), **leeg**
  (met next-step, geen dood einde), **fout** en **offline/geen-netwerk**? Of valt het
  scherm terug op niets?
- **Informatiehiërarchie** — staat het belangrijkste boven en groot? Concurreert er niets
  onnodig om aandacht (badge-regen, te veel accenten — principe 4)?
- **Eén primaire actie** — is er precies één gevulde knop/`FAB`, rest secundair? Staat
  aanmaken/bevestigen/verwijderen op de voorspelbare plek (`DESIGN.md` "Acties & knoppen")?
- **Affordances** — leest tikbaar als tikbaar (chevron op navigerende rijen, checkbox op
  afvink-rijen)? Is er geen verborgen long-press als enige toegang tot een actie?

### 2. Beslissing voor beslissing
Voor elk keuzemoment dat de module de gebruiker oplegt:

- **Default-check** — is de standaardkeuze de juiste voor het gezin-scenario (tiener/ouder/
  oma)? Kan de gebruiker meteen door zonder te kiezen?
- **Kan de keuze weg?** — elke keuze is frictie. Is de optie het waard, of kan een slimme
  default 'm vervangen?
- **Begrijpt de gebruiker de keuze?** — microcopy die uitlegt wat er gebeurt (rotatie =
  volgorde, niet selectie; split-type; welke periode telt; waarom deze settle-betaling).
- **Vergevingsgezind** — is de keuze terug te draaien (`DESIGN.md` principe 7)?

### 3. Flow voor flow
Voor elke end-to-end gebruikerstaak in de module (niet per scherm, maar de hele reis):

- **Loop 'm echt** — bijv. "plant toevoegen → soort/verzorging → afvinken waterbeurt →
  tijdlijn-foto" of "maaltijd plannen → ingrediënten → boodschappen → na koken → voorraad".
- **Waar haakt het?** — een stap die een onnodig scherm verder ligt, een actie die je
  alleen via een omweg bereikt, een dood einde zonder vervolgstap.
- **Deeplinks & terugkeer** — kun je van het ene domein naar het verwante springen
  (kaart → detail → gekoppelde taak → terug) zonder de draad kwijt te raken?
- **Cross-module-consistentie** — doet dezelfde handeling hetzelfde als in de buurmodule?

> **Output van een sessie.** Een korte notitie + een setje §6-rijen (`Insp.` S/M, `Status`
> ⏳). Houd elke rij klein en zelfstandig bouwbaar (geen migratie, units waar pure logica
> ontstaat). Zo wordt "ontleden" meteen "afmaken".

---

## De teardown-sessies (UXR-1 … UXR-8)

Gegroepeerd per **gebruikersreis/module-familie** (niet strikt per tab), zodat verwante
schermen in één sessie samenhangend bekeken worden. Aanbevolen volgorde = meest gebruikt /
hoogste "half"-dichtheid eerst.

| UXR | Module-familie | Schermen in scope |
|-----|----------------|-------------------|
| UXR-1 | **Vandaag / overzicht** | `vandaag.js` (hero + widgetgrid, bewerk-modus, widget-stijlen) |
| UXR-2 | **Taken & de tasks-weergaven** | `taken.js`, `agenda.js`, `schoonmaak.js`, `task/[id].js` — klopt de rolverdeling (STR-1) écht in gebruik? |
| UXR-3 | **Boodschappen** | `boodschappen.js`, favorieten-/vaste-boodschappen-sheet, catalogus |
| UXR-4 | **Kosten & delen** | `kosten.js`, `expense/[id].js`, `kosten-inzichten.js`, `delen.js`, `resource/[id].js` |
| UXR-5 | **Keuken-loop** | `maaltijden.js`, `recipe/[id].js`, `voorraad.js` — de menu→lijst→voorraad-reis |
| UXR-6 | **Zorg-modules** | `planten.js`/`plant/*`, `huisdieren.js`/`pet/*` — gedeelde verzorgings-/tijdlijn-infra |
| UXR-7 | **Setup & beheer** | `huishouden.js` (leden/subgroepen/module-toggles), `onboarding.js`, `instellingen.js` |
| UXR-8 | **Activiteit & navigatie-weefsel** | `activiteit.js` + cross-module deeplinks/terugkeer (sluit aan op UX-10/UX-12) |

Per sessie: loop de drie passes hierboven, leg bevindingen vast als §6-rijen, en pak de
goedkoopste meteen mee. UXR-1..8 zijn **parallelliseerbaar** (raken losse schermen).

---

## Voor de hand liggende quick wins (UX-15 … UX-20)

Deze hoeven niet op een sessie te wachten — ze kwamen scherp en herhaald uit de review en
zijn los bouwbaar op het bestaande systeem. Detail per item in backlog §6.

- **UX-15 — Laad-skeletons overal.** `ListSkeleton` bestaat (STR-4) maar wordt op de
  na-Fase-1.5 gebouwde modules niet gebruikt → blanco scherm tijdens laden. Rol uit op
  Maaltijden, Voorraad, Huisdieren, Delen, Kosten-inzichten, planten/agenda/schoonmaak waar
  nog niet.
- **UX-16 — Lege staten met next-step compleet maken.** STR-10 dekte de hoofdtabs; de
  nieuwere modules (Maaltijden, Voorraad, Huisdieren, Delen, Agenda) missen nog een
  uitnodigende lege staat met één duidelijke vervolgactie + illustratie.
- **UX-17 — Eén verwijder-/veeg-interactie overal.** Harmoniseer verwijderen: zichtbare
  swipe-to-delete + undo-toast (STR-5/STR-9-patroon) consistent op Boodschappen, Voorraad,
  en de modules die nu nog long-press of een kale modal gebruiken.
- **UX-18 — Inline "bewerken"-affordance op verzorging/ingrediënten.** Verzorgingskaart
  (plant/huisdier) en recept-ingrediënten zien er statisch uit; maak bewerkbaarheid
  zichtbaar (potlood-/chevron-affordance) i.p.v. impliciet.
- **UX-19 — "Voltooide wissen" + vier-de-voortgang consistent.** Taken-done-sectie en
  Voorraad-verlopen krijgen dezelfde bulk-opruimactie als Boodschappen; en een kleine
  "alles af vandaag"-viering (sluit aan op STR-11 / principe 6).
- **UX-20 — Periode-transparantie.** In Schoonmaak-eerlijkheid en Kosten-inzichten zichtbaar
  maken *welke* items in WEEK/MAAND/ALLES meetellen (subkop/telling), zodat de cijfers
  navolgbaar zijn.

---

## Aanpak in VSC

Geen migratie, geen nieuwe infra. Per quick win: pas het scherm aan met bestaande
componenten/tokens, draai `npm test` (blijft groen — raakt geen pure logica, tenzij je een
heuristiek toevoegt; dan een unit erbij), korte rooktest op web. Per UXR-sessie: leg de
bevindingen vast als nieuwe §6-rijen en commit de meegnomen quick wins per logische stap.

## Acceptatie

- Elke aangepakte module heeft een nette **loading-, lege- en foutstaat**.
- Verwijderen voelt overal hetzelfde en is **terug te draaien**.
- Geen detail-/kaartscherm dat data toont zonder de bijbehorende **handeling** binnen bereik.
- Elke UXR-sessie levert een korte notitie + concrete §6-rijen op (ontleden → afmaken).
- `npm test` blijft groen.
