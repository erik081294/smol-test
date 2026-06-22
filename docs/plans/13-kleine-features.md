# Plan 13 — Kleine features op bestaande data (PLA-8 + BOO-8)

**Backlog:** PLA-8 (cross-plant tijdlijn), BOO-8 (aankoopfrequentie leren). **Soort:** twee
kleine features bovenop bestaande tabellen. **Migratie:** nee (beide hergebruiken bestaand
schema). **Afhankelijkheden:** PLA-5 (plant-tijdlijn, af), BOO-3/BOO-5 (prijstracker +
catalogus, af).

## PLA-8 — Cross-plant tijdlijn (alle planten in één feed)

### Waarom
Per plant bestaat de tijdlijn al (`app/plant/[id].js` → `usePlantDiary` over `plant_photos`,
nieuwste eerst). Een **cross-plant** overzicht (alle planten door elkaar, nieuwste eerst)
maakt groei/gezondheid over de hele collectie zichtbaar zonder per plant te klikken.

### Datalaag (geen migratie)
`plant_photos` heeft sinds `0035` een nullbare `photo_path` (notitie-only kan) en `note`,
plus index `(plant_id, created_at desc)`. RLS erft de zichtbaarheid van de parent-plant.
Nieuw: een hook in `lib/usePlants.js`:
```js
export function useHouseholdPlantTimeline() {
  // useCollection('plant_photos', { order:[{column:'created_at',ascending:false}] })
  // select: '*, plant:plants ( id, name )'  -> elk item draagt de plantnaam
  // realtime op plant_photos (household-gescopet, zoals de bestaande hooks)
}
```
Hergebruik `usePlantPhotoUrl(path)` (signed URLs, lazy) en `signedPhotoUrl` uit
`lib/usePlants.js`/`lib/plantPhoto.js` — ongewijzigd.

### UI
- **Entree-punt** in `app/(tabs)/planten.js`: een `IconButton` "tijdlijn" in de `ScreenHeader`
  (`right`-slot) → `router.push('/planten/timeline')`.
- **Nieuw scherm** `app/planten/timeline.js` (+ `app/planten/_layout.js` indien nodig): één
  verticale feed; hergebruik het bestaande `TimelineEntry`-patroon uit `app/plant/[id].js`,
  maar toon per item ook de **plantnaam** (uit de join) en tik → `/plant/${plant.id}`. Nette
  `Empty`-staat (illustratie `plants`) bij geen entries.
- Geen nieuwe pure logica strikt nodig; eventueel een mini-helper `groupTimelineByDay(entries)`
  (puur, met unit) voor dag-kopjes ("Vandaag", "Gisteren", datum) — optioneel.

### Acceptatie
Een feed toont entries van álle zichtbare planten, nieuwste eerst, met plantnaam + (optioneel)
foto + notitie; tikken opent de plant. Niet-zichtbare planten (subgroep) verschijnen niet
(RLS). `npm test` groen, lint 0 errors.

---

## BOO-8 — Aankoopfrequentie leren ("je koopt dit meestal rond nu")

### Waarom
Uit de bonhistorie (`purchase_items.product_id` + `purchases.purchased_on`) is af te leiden
dat je een product ~elke N dagen koopt. Een **zachte suggestie** ("meestal om de ~14 dagen —
voor het laatst 12 dagen geleden") helpt iets op de lijst te zetten vóór het op is. Bewust
**simpel en uitlegbaar** (geen zware voorspelling), als aanvulling op de prijstracker.

### Grens met VOO-1 (voorraad-urgentie)
Houd de assen gescheiden: **VOO-1** kijkt naar *houdbaarheid + drempel* ("bijna op/verlopen");
**BOO-8** kijkt naar *historisch koopinterval* ("je koopt dit normaal nu weer"). Complementair,
niet dubbel. BOO-8 werkt ook voor producten die niet in de voorraadmodule zitten.

### Pure logica (geen migratie) + units
Nieuw `lib/buyFrequency.js` (puur), met `tests/buyFrequency.test.js`:
```js
// Intervallen tussen opeenvolgende aankoopdatums per product.
export function purchaseIntervals(dates);            // -> [dagen, ...]
export function frequencyEstimate(dates, now);
//  -> { count, medianDays, lastPurchasedOn, daysSince, dueScore }  of null bij < 2 aankopen
//  dueScore = daysSince / medianDays  (>=1 ~ "weer tijd"); robuust op mediaan i.p.v. gemiddelde
export function frequencyLabel(est);                 // -> "meestal om de ~14 dagen" / null
```
Databron: `useProductPrices(productId)` levert al `{ purchased_on, store, unit_price_cents }`
gesorteerd; een lichte aggregatiehook `useProductFrequencies()` kan per product de laatste
aankoopdatums leveren (één query op `purchase_items` join `purchases`, household-gescopet) —
of leun op de al getrackte `products.last_added_at`/`times_added` (trigger `0029`) voor een nog
goedkopere v1. **Aanrader v1:** mediaan-interval uit `purchase_items`-datums; `times_added` als
fallback-signaal.

### UI
- In `app/(tabs)/boodschappen.js`: bij de catalogus-/favorietensuggesties (nu via
  `useProducts.suggestFor` + `lib/favoriteGroceries.js`) een **"weer tijd?"-sectie** of een
  badge op producten met `dueScore >= 1` ("meestal om de ~N dagen"). Niet opdringerig: een
  suggestierij "Misschien weer nodig", één tik = toevoegen via de bestaande `add_groceries`-flow.
- Toon `frequencyLabel` als subtiele meta; nooit een harde melding.

### Acceptatie
Producten met genoeg historie (≥2 aankopen) krijgen een uitlegbare frequentie-hint; de
"weer tijd?"-suggestie verschijnt alleen bij `dueScore >= 1` en voegt met één tik toe.
`purchaseIntervals`/`frequencyEstimate`/`frequencyLabel` hebben units. Lint 0 errors.

## File-checklist
**Nieuw:** `app/planten/timeline.js` (+ evt. `_layout.js`) · `lib/buyFrequency.js` +
`tests/buyFrequency.test.js` · evt. `lib/usePlants.js`→`useHouseholdPlantTimeline` en een
`useProductFrequencies` aggregatiehook.
**Gewijzigd:** `app/(tabs)/planten.js` (tijdlijn-entree) · `app/(tabs)/boodschappen.js`
("weer tijd?"-suggestie) · `lib/i18n.js` (`plants.timeline.*`, `groceries.again.*`) ·
`huishoek-backlog.md` (PLA-8/BOO-8 status).
