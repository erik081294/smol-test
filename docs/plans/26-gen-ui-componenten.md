# Plan 26 — Industry-leading interactieve gen-UI-componenten (AI-16, ronde 1)

> Backlog: **AI-16** (Next/Should/L) + de afhankelijkheidsbeslissing over **AI-7**.
> Status leeft uitsluitend in backlog §6; dit doc is het *hoe* van ronde 1.

## Doel & waarom

De gen-UI-nodes van de assistent zijn functioneel maar vlak: het weekmenu is een platte
tekstlijst, uitgaven zijn een keyvalue-tabelletje, en beslissen tussen opties kan alleen
via chips zonder context. AI-16 wil componenten waarmee de assistent stuk-voor-stuk
**industry-leading UI** bouwt: interactief, mooi, toegankelijk en thema-veilig — de chat
wordt daarmee een volwaardige tweede voordeur van de app in plaats van een tekstuele
bijrijder.

Ronde 1 levert de drie meest waardevolle componenten plus de eerste écht *live*
interactie (porties herrekenen), binnen de bestaande veiligheidsarchitectuur:
render blijft server-side deterministisch, de client-poortwachter blijft de enige
weg naar de renderer, en er verandert **niets** aan tool-descriptions, prompt of
`data`-payloads (dus géén eval-gate nodig; de golden-set blijft byte-stabiel).

## De AI-7-beslissing (bewust, spijtvrij)

AI-16 hing formeel op AI-7 (A2UI v0.9 wire-alignment: `beginRendering`/`surfaceUpdate`/
`dataModelUpdate`). Voor de waarde van ronde 1 is dat wire-protocol **niet nodig**:

- De "live update"-interactie (porties bijstellen → ingrediënten herrekenen) kan
  volledig **client-lokaal en puur** over de bestaande platte tree: de node draagt
  gestructureerde data (het "data-model" in het klein), een pure functie herrekent,
  React rendert. Geen server-round-trip, geen patch-berichten.
- De platte tree blijft de compat-vorm (guidelines §10) — een latere AI-7-ronde kan
  het wire-protocol eronder schuiven zonder deze componenten te raken.

**Besluit:** AI-7 blijft `Later`; ronde 1 bouwt de interactie client-lokaal. Dit staat
ook als notitie in backlog §6 bij AI-7.

## Wat er komt (+3 node-types, §9-max, + 1 verrijking)

### 1. `chart` — interactieve staafgrafiek (kosten)

Eén-serie staafgrafiek over `react-native-svg` (zit al in de app: `lib/illustrations.js`).

- **Contract** (server → client): `{ type:'chart', title?, unit:'euro'|null,
  points:[{ label, value≥0 }], text }`. `unit:'euro'` ⇒ `value` is **centen** (zoals
  alle geld in de app). `text` is de degradatie-regel voor oude clients (de
  poortwachter degradeert onbekende types naar tekst via `node.text`).
- **Bron:** `renderExpensesSummary` (kosten-pack) levert naast de bestaande
  keyvalue-kaart een chart met **uitgaven per week** van de maand (pure bucketing
  op `spent_on`, dag 1–7 / 8–14 / 15–21 / 22–28 / 29–eind). `data` blijft
  byte-identiek.
- **Vorm (dataviz-methode, gevalideerd):** één serie ⇒ één hue, geen legenda; staven
  in `colors.forest`, dunne marks met afgeronde datatop (4px) op een basislijn in
  `colors.line`; recessief grid (2 hulplijnen: helft + max, "nice" afgerond);
  tekst draagt áltijd ink-tokens, nooit de seriekleur. **Relief is verplicht**
  (donker thema: forest op surface = 2,7:1 < 3:1): directe waarde-labels op de
  hoogste én de geselecteerde staaf, plus een a11y-label per staaf én `treeToText`
  als tabelvorm. Geselecteerde staaf = `colors.forestSoft` (het pressed-token) —
  bewust geen oker-fill (2,18:1 op wit oppervlak).
- **Interactie:** tik een staaf → selectie + waarde-callout (tik nogmaals = deselect).
  Touch-targets: de tikzone is de volledige kolom (≥ de staafbreedte), niet de staaf.
- **Pure layout-logica** in `lib/assistantGenUi.js`: `niceMax` (afronden naar
  1/2/2,5/5×10ᵏ), `chartLayout` (points → fracties + ticks), `formatChartValue`
  (centen → "€ 1.250", count → "12"). Unit-getest, mutatie-bewaakt.

### 2. `schedule` — week-/dagrooster (weekmenu)

- **Contract:** `{ type:'schedule', title?, days:[{ label, today?:bool,
  entries:[{ text, emoji? }] }], text }`. `today` wordt **server-side** bepaald
  (`ctx.today`) — de client rekent niet met klok/tijdzone. Navigatie zit bewust
  níét op de node: details lopen via een losse `link`-node ernaast (guidelines
  §8) — geen tweede route-pad naast de bestaande whitelist.
- **Bron:** `renderWeekMenu` bouwt nu een schedule met **álle** dagen van het venster
  (ook lege — gaten in het menu wórden informatie), i.p.v. de platte lijst. Lege
  dagen tonen "—" (faint). `data` blijft byte-identiek; oude clients degraderen
  naar de tekst-fallback.
- **Vorm:** dagrij = vast daglabel (label-token) + entries; vandaag krijgt een
  forest-accentbalkje + vetgedrukt daglabel + "vandaag"-caption. De rijen zelf
  blijven rustig (geen verstopte tikdoelen — UX-42-lijn); navigatie desgewenst
  via een link-node eronder.

### 3. `choice` — beslis-kaart (AskUserQuestion-patroon)

- **Contract:** `{ type:'choice', prompt, options:[{ label, description?, reply }]
  (1–6), text }`. `reply` is de letterlijke gebruikerstekst die een tik instuurt.
- **Bron:** `renderRecipeMatches` zet bij **≥2 treffers** een choice-kaart onder de
  recept-kaarten: "Welke bedoel je?" met per treffer label (titel) + omschrijving
  (porties) + reply ("Gebruik het recept \"X\""). Chips (suggest_replies) blijven
  bestaan voor model-gedreven vervolgstappen; choice is de server-gerenderde,
  deterministische variant mét context.
- **Interactie:** tik = `onChoice(reply)` → hetzelfde `send()` als vrij typen. Het
  invoerveld blijft altijd beschikbaar (guidelines §8: opties versnellen, beperken
  nooit). Geen args, geen tool-calls vanaf de kaart — een reply is gewoon een
  gebruikersbeurt, dus de hele HITL-keten blijft onaangeroerd.

### 4. Verrijkte `recipe` — porties-stepper met live herrekening

- **Contract-uitbreiding:** ingrediënten dragen naast `text` optioneel gestructureerd
  `{ name, quantity, unit }` (server `renderRecipe` levert beide; oude clients
  negeren de extra velden — het bestaande `text`-pad blijft intact).
- **Interactie:** staat er `servings` op de kaart én zijn er gestructureerde
  hoeveelheden, dan toont de kaart een porties-`Stepper` (bestaand ui-primitief).
  Verstellen herrekent de ingrediëntregels **client-lokaal en puur**:
  `scaleIngredients(ingredients, from, to)` + `formatQuantity` (max 2 decimalen,
  NL-komma, geen zwevende restjes zoals `0.30000000000000004`).
- Dit is het AI-16-(3)/patch-model-voorbeeld ("porties bijstellen → ingrediënten
  herrekenen") — zonder wire-protocol. De kaart is een weergave; opslaan/HITL
  verandert niet mee (bewust: het voorstel blijft de opgeslagen args).

## Architectuur-invariants (wat NIET verandert)

- Render komt uitsluitend uit `render*`-helpers over tool-output — het model kan
  geen chart/choice/schedule fabriceren (prompt-injectie-lijn, guidelines §1).
- `data` naar het model blijft per tool **byte-identiek**; tool-descriptions en
  systemprompt onaangeroerd ⇒ geen eval-gate nodig (guidelines §6).
- De poortwachter (`normalizeNode`) blijft de enige route naar de renderer; nieuwe
  types valideren streng (routes '/'-only, waarden eindig en ≥0, caps op aantallen).
- Onbekende types blijven degraderen naar tekst; élk nieuw server-node draagt een
  `text`-fallback zodat een oudere app-versie leesbare inhoud toont.

## Bestanden

| Bestand | Wat |
|---|---|
| `lib/assistantUi.js` | +3 normalizers (`chart`/`schedule`/`choice`), recipe-verrijking, `treeToText`-takken |
| `lib/assistantGenUi.js` **(nieuw)** | pure interactie-logica: `niceMax`, `chartLayout`, `formatChartValue`, `formatQuantity`, `scaleIngredients`, `clampServings` — `// @ts-check` |
| `lib/AssistantMessageView.js` | renderers: `ChartNode`, `ScheduleNode`, `ChoiceNode`, porties-stepper op recipe; `onChoice`-prop |
| `lib/AssistantChat.js` | `onChoice` doorlussen naar `send()` |
| `lib/i18n.js` | nieuwe strings (rooster/keuze/porties/grafiek-a11y) |
| `supabase/functions/_shared/tools/maaltijden.js` | `renderWeekMenu`→schedule, `renderRecipe`→structured ingredients, `renderRecipeMatches`→choice bij ≥2 |
| `supabase/functions/_shared/tools/kosten.js` | `renderExpensesSummary`→+chart (weekly buckets, pure helper) |
| `tests/assistantUi.test.js` | vaste set + nieuwe types (het "onbekend type"-voorbeeld verhuist van `chart` naar `gauge`) |
| `tests/assistantGenUi.test.js` **(nieuw)** | layout-/schaal-/formatteer-units (grenswaarden, defaults) |
| `tests/assistantToolsMaaltijden.test.js`, `tests/assistantToolsKosten.test.js` | render-contracten bijgewerkt |
| `scripts/mutation-groups.mjs`, `tsconfig.check.json` | `lib/assistantGenUi.js` opnemen |
| `docs/assistent-architectuur.md` §9 | node-set + interactieregels bijwerken |

## Definition of done (CLAUDE.md)

1. Mutatie-ratchet groen op alle geraakte modules (`--since=origin/main`).
2. Elke nieuwe `export function` heeft een unit-test in dezelfde PR.
3. `npm run typecheck` groen (nieuwe module in de check-scope).
4. `npm test` volledig groen.
5. Docs: backlog §6 (AI-16 ◐, AI-7-notitie), voortgang-logboek, dit plan in 00-overzicht.

## Rest (na deze ronde, expliciet open)

- **Edge-deploy** (de render-helpers leven server-side; productie draait v16 — de
  AI-17-deploy uit PR #126 staat óók nog open, dus één deploy vangt beide).
- **Device-verificatie** (moto): chart-tik, rooster, choice→reply, porties-stepper,
  beide thema's.
- **Ronde 2-kandidaten:** choice-node breder inzetten (b.v. catalogus-matches AI-11),
  `image`/`progress`-nodes (AI-7-set), grafiek-varianten (lijn voor trends) — max +3
  per ronde blijft de wet.
