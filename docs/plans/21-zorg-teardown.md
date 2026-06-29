# Plan 21 — Teardown Zorg-modules (UXR-6: Planten + Huisdieren)

> **Status (2026-06-29):** voorbereiding van de gezamenlijke teardown-sessie van de
> Zorg-modules (Planten + Huisdieren), net als plan 20 voor Schoonmaak. De lens/werkwijze
> leunt op [plan 14](14-ux-module-teardown.md). Hieronder de **huidige stand**
> (code-geverifieerd), de **wensen** (PLA-10), de **open beslissingen**, en wat in deze
> sessie al **doorgevoerd** is (de "verzorging bewerken"-eerste-stap).

**Backlog:** UXR-6 (deze sessie) + PLA-10 (grip op de verzorgingstaken). De teardown
levert straks concrete `PLA-NN`/`HUI-NN`/`UX-NN`-rijen op.
**Soort:** UX-diepgang. Geen zekere migratie — dat is juist een van de beslissingen
(een echte "pauzeren"-staat zou er één vragen; "bewerken" niet).
**Schermen in scope:** [`app/(tabs)/planten.js`](../../app/(tabs)/planten.js) +
[`app/plant/[id].js`](../../app/plant/%5Bid%5D.js),
[`app/(tabs)/huisdieren.js`](../../app/(tabs)/huisdieren.js) +
[`app/pet/[id].js`](../../app/pet/%5Bid%5D.js), de zorg-regels
([`lib/plantCare.js`](../../lib/plantCare.js), [`lib/petCare.js`](../../lib/petCare.js))
en de gedeelde taak-editor ([`app/task/[id].js`](../../app/task/%5Bid%5D.js)).

---

## 1. Huidige stand (code-geverifieerd, 2026-06-29)

- **Verzorgingstaken zijn gewone `tasks`.** Een plant-taak heeft `plant_id` + category
  `plant`, een huisdier-taak `pet_id` + category `huisdier`. Ze worden regelgebaseerd
  gegenereerd (`buildCareTasks` in `plantCare.js`/`petCare.js`) en lopen via de bestaande
  recurrence-logica. De volledige cadans (interval/weekdagen/herhaal-einde) is dus al
  bewerkbaar in de taak-editor.
- **Het detail toont de taken, maar de tik was een dode tik.** Plant- én huisdier-detail
  renderden de taakrijen mét `onToggle` maar **zonder** `onPress`. `TaskRow` valt dan terug
  op `taskHref(task)` → en die routeert een `plant_id`/`pet_id`-taak naar… ditzélfde detail.
  Tikken op een verzorgingstaak deed daar dus niets. *(De backlog-bewering bij PLA-10 dat de
  taakrijen "al de editor openen" klopte niet met de code — dit was het echte gat.)*
- **Een eigen verzorgingstaak toevoegen kon op de plant niet, op het huisdier wél.** Het
  huisdier-detail had al een "verzorging aanpassen"-sheet (`openCareSheet`); de plant niet.
- **De taak-editor is bewust de "afspraken"-editor.** Categorie/zone-keuze is eruit, maar
  module-taken behouden hun velden via passthrough (zone_id, rotation, assigned_to). `plant_id`
  zat nog **niet** in de passthrough/payload.
- **Lege-staat-kaarten zonder handeling.** Een plantkaart zonder volgende-watergeven-datum
  en een huisdierkaart zonder taken tonen weinig richting (UXR-6-aandachtspunt: "kaart zonder
  handeling").
- **Soort wijzigen:** plant-soort is bewerkbaar via de bewerk-sheet; huisdier-soort via de
  editor met "Anders, namelijk…" (HUI-2). Parity is redelijk; bevestigen in de sessie.

---

## 2. De wensen (PLA-10, toestelfeedback)

1. **Per-plant grip op één plek** — snel een verzorgingstaak aanpassen (interval),
   pauzeren/hervatten of een eigen verzorgingstaak toevoegen, zónder per taak te zoeken.
2. **Verzorging bewerken zonder omwegen** — de taak vanaf het detail kunnen openen en
   aanpassen (de "dode tik" hierboven).
3. **Parity plant ↔ huisdier** — dezelfde grip op beide zorg-modules.

---

## 3. In deze sessie al doorgevoerd (eerste stap)

Klein, reversibel, zonder migratie — de kern van "verzorging bewerken":

- **Dode tik weg (plant + huisdier).** De verzorgingstaakrijen openen nu de taak-editor
  (`onPress={() => router.push('/task/<id>')}`) → interval/frequentie/weekdagen/herhaal-einde
  aanpassen of (via het herhaal-einde) effectief stoppen.
- **"Taak toevoegen" op de plant.** Een eigen verzorgingstaak voor déze plant via
  `/task/new?plant=<id>`. De editor kreeg een `plant`-passthrough (symmetrisch met `zone`):
  category `plant` + `plant_id` in de payload, zodat de taak aan de plant hangt. Het huisdier
  had zijn eigen "verzorging aanpassen"-sheet al.

**Rest = device-rooktest** (taak openen → interval wijzigen → opslaan; nieuwe plant-taak
aanmaken en op het plantdetail terugzien).

---

## 4. Open beslissingen (samen te maken vóór verder bouwen)

- **A. Pauzeren — gedrag en staat.** "Pauzeren-en-hervatten" kan (a) **zonder migratie** als
  het herhaal-einde / de taak verwijderen-en-opnieuw, of (b) **met een expliciete staat**
  (`tasks.paused` of een archief-vlag → migratie) zodat een gepauzeerde regel zichtbaar
  "uit" staat en met één tik terugkomt. Voorkeur peilen: hoe vaak pauzeert iemand echt?
- **B. Eigen verzorgingstaak — visibility.** Een handmatig toegevoegde plant-taak staat nu
  default op household-zichtbaar (editor-default), terwijl `buildCareTasks` de zichtbaarheid
  van de plant erft. Willen we de plant-visibility overnemen bij `?plant=<id>` (vraagt het
  doorgeven van de plant-zichtbaarheid aan de editor)?
- **C. Per-plant overzicht vs. de generieke editor.** Is "tik → taak-editor" genoeg grip, of
  willen we een compacte per-plant lijst (alle verzorgingsregels met aan/uit + interval inline),
  zoals de huisdier-`openCareSheet`? Parity-richting kiezen.
- **D. Lege-staat-kaarten.** Een kaart zonder eerstvolgende actie een duidelijke
  "verzorging instellen"/"taak toevoegen"-ingang geven (sluit op UX-44-feedbacklijn).

---

## 5. Voorgestelde bouwvolgorde (na de beslissingen)

1. **(gedaan)** Dode tik weg + "Taak toevoegen" op de plant.
2. **Pauzeren** (beslissing A) — eerst zonder migratie als dat volstaat; anders een staat.
3. **Per-module care-overzicht** (beslissing C) — desgewenst de huisdier-`openCareSheet`-stijl
   naar de plant trekken (of beide naar één gedeeld component), zodat plant ↔ huisdier
   identiek voelen.
4. **Lege-staat-handelingen** (beslissing D).

> Hergebruik overal de beproefde lagen — de recurrence-engine van de taak-editor, de
> bestaande `buildCareTasks`-regels, de gedeelde `TaskRow` — i.p.v. parallelle logica. Elke
> pure helper die hieruit ontstaat krijgt in dezelfde PR een unit-test + valt onder de
> mutatie-ratchet, conform de definition of done in `CLAUDE.md`.
