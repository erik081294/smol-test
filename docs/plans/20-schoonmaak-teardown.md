# Plan 20 — Teardown Schoonmaak (UXR-9, "samen strak zetten")

> **Status (2026-06-28):** klaargezet op verzoek (toestelfeedback). Dit is de *voorbereiding*
> van de gezamenlijke teardown-sessie van de Schoonmaak-module, niet de oplossing zelf — net
> als de andere UXR-rijen. De lens/werkwijze leunt op [plan 14](14-ux-module-teardown.md);
> hieronder de **huidige stand** (code-geverifieerd) + de **concrete wensen** (SCH-4) + de
> **open beslissingen** die we samen moeten maken vóór we bouwen.

**Backlog:** UXR-9 (deze sessie) + SCH-4 (de concrete feature-wensen). De teardown levert
straks concrete §6-rijen op (een nieuwe `SCH-NN` of `UX-NN`); UXR-9 is de *sessie*.
**Soort:** UX-diepgang. Mogelijk een kleine datalaag-uitbreiding (custom rooster), geen
zekere migratie — dat is juist een van de beslissingen.
**Schermen in scope:** [`app/(tabs)/schoonmaak.js`](../../app/(tabs)/schoonmaak.js),
de zones/sjablonen-laag ([`lib/cleaningTemplates.js`](../../lib/cleaningTemplates.js),
[`lib/useZones.js`](../../lib/useZones.js)), de taak-editor
([`app/task/[id].js`](../../app/task/%5Bid%5D.js)) en de Taken-tab
([`app/(tabs)/taken.js`](../../app/(tabs)/taken.js)).

---

## 1. Huidige stand (code-geverifieerd, 2026-06-28)

Wat er nú is, zodat we niet op geheugen ontwerpen:

- **Zones dragen de module.** `schoonmaak.js` toont per **zone** een kaart met de open
  taken (`task.zone_id != null`); een "schoonmaaktaak" = een taak die aan een zone hangt.
  Eronder een eerlijkheidsoverzicht ("Wie deed hoeveel", week/maand/alles) — dat ziet de
  module dus al per week/maand, maar enkel voor de *telling*, niet voor het rooster.
- **Losse taak toevoegen** kan al: per zone-kaart een "Taak toevoegen"-knop →
  `/task/new?zone=<id>` opent de gedeelde taak-editor met de zone voorgevuld.
- **Rooster = vast sjabloon.** "Schoonmaak instellen" opent een sheet met
  `CLEANING_TEMPLATES` (twee hardcoded schema's: "Standaard week", "Licht schema"). `planTemplate()`
  maakt daaruit zones + terugkerende `tasks`. Je kunt een sjabloon **kiezen**, niet **samenstellen**.
- **Zones zijn vrij muteerbaar in de datalaag, maar niet in de UI.** `useZones` exporteert
  `addZone`/`updateZone`/`removeZone`, maar er is **geen UI** om los een zone toe te voegen,
  te hernoemen of te verwijderen buiten de sjabloon-flow om.
- **Recurrence is rijk.** De taak-editor kan dagelijks/wekelijks/maandelijks, interval,
  vaste weekdagen én een herhaal-einde (nooit/tot-datum/aantal). Een custom terugkerende
  schoonmaaktaak = technisch al een "rooster-regel".
- **Taken-tab filtert nog niet op schoonmaak.** `taken.js` filtert op categorie/toegewezene/
  subgroep/tags/status, maar **niet op zone**, en leest **geen** route-param om voorgefilterd
  te openen. Een "schoonmaakfilter-deeplink" bestaat dus nog niet.

---

## 2. De wensen (SCH-4, toestelfeedback)

1. **Zelf custom schoonmaaktaken én roosters opstellen** — niet alleen een vast sjabloon
   kiezen, maar zelf een ritme samenstellen (eigen taken + frequentie + weekdagen per zone).
2. **Strak onderscheid taken vs. rooster opstellen** — nu lopen "een losse taak toevoegen"
   en "een heel schema neerzetten" door elkaar in dezelfde module. Maak helder wélke je doet.
3. **Rooster per week en per maand kunnen bekijken** — mogelijk via een **deeplink met
   schoonmaakfilter naar de Taken-tab** i.p.v. een eigen weergave (hergebruik de bestaande
   taken-filters/weergaven).

---

## 3. Open beslissingen (samen te maken vóór we bouwen)

Dit zijn de keuzes die de uitwerking bepalen — bewust nú niet eenzijdig ingevuld:

- **A. Wat ís een "schoonmaaktaak" voor het filter?** `zone_id != null` (de huidige,
  scherpe definitie) of de taak-categorie? De templates zetten nu categorie `huishouden`,
  maar `huishouden` kan ook niet-schoonmaak bevatten. → Waarschijnlijk **zone-gebaseerd**,
  wat betekent dat een schoonmaakfilter een **zone-as** in de taakfilters vraagt
  (`applyTaskFilters` + `TaskFilterSheet` in `taken.js`/`lib/agenda.js`).
- **B. Eigen weergave of deeplink naar Taken?** Een week/maand-rooster-weergave bouwen in
  Schoonmaak zelf, óf een knop "Rooster bekijken" die naar `/taken?…schoonmaak…` deeplinkt
  met de zone/categorie-filter aan. Deeplink hergebruikt de bestaande Taken-weergaven (minder
  code), maar vraagt route-param-parsing in `taken.js` (nu afwezig).
- **C. Custom rooster — UI én opslag.** Een "rooster samenstellen"-builder (zones kiezen +
  per zone frequentie/weekdagen) bovenop de bestaande recurrence-logica. Vraag: blijft een
  rooster gewoon **een set terugkerende `tasks`** (geen migratie, simpel) of willen we een
  benoemd, herbruikbaar "rooster-object" (eigen tabel, migratie, herbruikbaar/aan-uit)?
  → Voorkeur: **eerst zonder migratie** (rooster = terugkerende taken), tenzij we benoemde,
  herbruikbare roosters echt nodig vinden.
- **D. Zone-beheer in de UI.** Willen we losse zone-CRUD (toevoegen/hernoemen/verwijderen)
  zichtbaar maken (datalaag kan het al), zodat custom roosters niet aan de sjabloon-zones
  vastzitten?

---

## 4. Voorgestelde bouwvolgorde (na de beslissingen)

Oplopend in inspanning; elke stap levert los waarde en is reversibel:

1. **Onderscheid taken vs. rooster** in `schoonmaak.js` — twee duidelijke ingangen
   ("Taak toevoegen" vs. "Rooster opstellen/aanpassen"), zodat beslissing #2 (wens) los staat
   van de rest. Geen datalaag.
2. **Schoonmaakfilter-deeplink** (beslissing A+B) — zone-as in de taakfilters +
   route-param-parsing in `taken.js`, en een "Rooster bekijken (week/maand)"-knop in Schoonmaak.
3. **Custom rooster-builder** (beslissing C) — zones kiezen + per zone frequentie/weekdagen,
   bovenop de bestaande recurrence; schrijft terugkerende `tasks` (zoals `planTemplate` nu doet),
   maar met door de gebruiker gekozen waarden i.p.v. een hardcoded sjabloon.
4. **(optioneel) Zone-beheer** (beslissing D) — losse zone-CRUD-UI.

> Hergebruik overal de beproefde lagen — de recurrence-engine van de taak-editor, `useZones`'
> bestaande CRUD, de Taken-filters — i.p.v. parallelle logica. Elke pure helper die hieruit
> ontstaat (bv. een `buildCustomSchedule`) krijgt in dezelfde PR een unit-test + valt onder de
> mutatie-ratchet, conform de definition of done in `CLAUDE.md`.
