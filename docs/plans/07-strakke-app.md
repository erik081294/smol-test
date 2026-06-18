# Plan 07 — Strakke app (Fase 1.5 "Strak & af")

**Backlog:** STR-1 t/m STR-11 (Platform/UX, Fase 1.5). **Soort:** UX-cohesie,
interactie-polish, informatie-architectuur. **Migratie:** nee — dit is een
opschoon-/afwerkronde op de bestaande app, geen nieuwe datalaag.
**Afhankelijkheden:** geen nieuwe; leunt volledig op het bestaande design-systeem
(`lib/theme.js`, `lib/ui.js`, `DESIGN.md`).

## Waarom deze ronde

Het fundament is sterk, de uitvoering is ongelijk. De goede schermen
(`app/(tabs)/vandaag.js`, `taken.js`, `meer.js`) bewijzen dat het systeem werkt;
mid-tier schermen improviseren. Het "kale" gevoel komt uit drie gaten:

1. **Cohesie (visueel)** — ~76 rauwe `TouchableOpacity`, hardcoded
   `padding`/`gap`/`borderRadius` i.p.v. tokens, zelfgebouwde rijen/checkboxes/
   emoji-pickers. Ergste: `boodschappen.js`, `huishouden.js`, `expense/[id].js`.
2. **Feel (interactie)** — geen optimistic UI (elke tik wacht op de Supabase-
   roundtrip), geen haptics (`expo-haptics` geïnstalleerd maar ongebruikt), geen
   toast/ongedaan-maken, verborgen long-press-delete, `motion`-tokens nooit gebruikt,
   validatie via blokkerende `Alert` i.p.v. de bestaande `Field`-`error`-prop.
3. **IA (waar woont iets)** — één `tasks`-tabel via vier schermen (Vandaag, Taken,
   Agenda, Schoonmaak), gepresenteerd alsof het vier aparte bakken zijn.

**Bijna alles hier is _toepassen wat al bestaat_** — geen nieuwe infrastructuur.

De thema's zijn los oppakbaar; bouw in de aanbevolen volgorde onderaan.

---

## Thema A — Informatie-architectuur & navigatie

### STR-1 — Eén bron (`tasks`), expliciete weergaven

#### Waarom
Een taak kan nu opduiken in Vandaag, Taken, Agenda én Schoonmaak. Dat is geen
databug (het is één tabel) maar de UI maakt de rolverdeling niet duidelijk, dus
de gebruiker weet niet "waar iets woont".

#### Rolverdeling (te bevestigen bij start)
| Scherm | Rol | Aard |
|--------|-----|------|
| **Vandaag** | "Wat moet er nú?" — cross-module dagoverzicht (taken + plantzorg + afspraken) | startpunt, blijft |
| **Taken** | "Alles wat we moeten doen" — canonieke lijst + beheer (aanmaken, terugkeer, toewijzing, rotatie) | bron-beheer |
| **Agenda** | "Wanneer" — maandgrid op taken mét datum/tijd | weergave op `tasks` |
| **Schoonmaak** | "Onderhoud per ruimte" — zone-gefilterde taken + rooster + eerlijkheid | gespecialiseerde weergave op `tasks` |

#### Aanpak
- **Maak de rol zichtbaar** via `ScreenHeader`-subtitels op `agenda.js` /
  `schoonmaak.js` (bv. "Je taken op de kalender", "Onderhoud per ruimte"), zodat
  het visueel als weergave leest, niet als aparte bak.
- **Eén gedeelde rij + edit-flow overal**: `lib/TaskRow.js` en `app/task/[id].js`
  zijn al de gedeelde bouwstenen — controleer dat Agenda en Schoonmaak ze allebei
  gebruiken (geen lokale variant), zodat een taak die je in Schoonmaak afvinkt ook
  uit Vandaag/Taken verdwijnt. Gedrag is al consistent via `useTasks`; het gaat om
  de *presentatie*.
- **Context-aware "nieuwe taak"-entry**: dezelfde editor, voorgevulde context.
  `app/task/[id].js` leest al routeparams — breid uit zodat openen vanuit
  Schoonmaak `zone_id`/categorie voorvult en vanuit Agenda de `due_date`. Eén
  mentaal model, geen aparte invoervelden per scherm.
- **Boodschappen blijft bewust een aparte _items_-stroom** (afvinklijst, geen
  taak). Houd het herkenbaar anders, maar wél uit dezelfde componenten opgebouwd.

#### Files
**Gewijzigd:** `app/(tabs)/agenda.js`, `app/(tabs)/schoonmaak.js` (subtitels +
gedeelde `TaskRow`), `app/task/[id].js` (context-prefill uit routeparams),
eventueel `app/(tabs)/vandaag.js` (consistente entry).

### STR-2 — Navigatie-helderheid

#### Aanpak
- **Affordance op navigerende rijen**: een chevron (`Icon name="chevron"` via
  `lib/icons.js`) als `trailing` op `ItemRow`/`Card` die ergens heen navigeren, zodat
  "dit is tikbaar" zichtbaar is. Niet op afvink-rijen (die hebben al een checkbox).
- **Consistente terug/sluit**: detailschermen gebruiken `ModalHeader`; controleer
  `expense/[id].js` (read-only view heeft nu een rauwe back-`TouchableOpacity`).
- **Heroverweeg Schoonmaak primair vs. Meer** op basis van de rol uit STR-1. De
  tabbalk-logica zit goed in `app/(tabs)/_layout.js` + `lib/modules.js` (alleen de
  `primary`-vlag omzetten) — niet herbouwen.

#### Files
**Gewijzigd:** `lib/ui.js` (optionele `chevron`-affordance op `ItemRow`),
`app/expense/[id].js`, eventueel `lib/modules.js` (`primary`-vlag Schoonmaak).

---

## Thema B — Component-cohesie

### STR-3 — Schermen naar `lib/ui.js` trekken

#### Waarom
"Pak een token, verzin geen waarde" en "pak een component, niet een rauwe
Pressable" zijn de twee meest geschonden regels uit `DESIGN.md`.

#### Aanpak (volgorde naar impact)
1. **Boodschappen** (`app/(tabs)/boodschappen.js`) — rauwe `TextInput`→`Field`,
   `+`-knop→`Button`/`FAB`, handmatige lijstrijen→`ItemRow`, `padding: 10`→`space.*`.
2. **Huishouden** (`app/(tabs)/huishouden.js`) — ~15 `TouchableOpacity`: leden-,
   subgroep-, huishouden- en module-rijen→`ItemRow`; invite-code in een `Card`;
   hardcoded `padding: 14/12`→tokens.
3. **Uitgave-editor** (`app/expense/[id].js`) — deelnemer-rijen→`ItemRow`, eigen
   checkbox→`Checkbox`, betaler/gewicht-controls→gedeelde picker (STR-4).
4. Daarna **Taak-editor** (`app/task/[id].js`) en **Plant-editor**
   (`app/plant/[id].js`): weekdag-knoppen, datum-stepper, foto-/dagboek-thumbs en
   verzorgingskaart op tokens; avatar-/lid-keuze op de gedeelde picker (STR-4).

**Regel:** geen losse `fontSize`/`padding`/`borderRadius` meer in een scherm —
altijd `type`/`space`/`radius`. Geen rauwe `Pressable` waar een component bestaat.

#### Files
**Gewijzigd:** `app/(tabs)/boodschappen.js`, `app/(tabs)/huishouden.js`,
`app/expense/[id].js`, `app/task/[id].js`, `app/plant/[id].js`, `app/onboarding.js`.

### STR-4 — Ontbrekende gedeelde componenten

#### Waarom
Dezelfde patronen zijn 3× zelfgebouwd. Eén keer goed in de bibliotheek = overal goed.

#### Aanpak — toevoegen aan `lib/ui.js`
- **`MemberPicker` / `AvatarSelect`** — horizontale lijst aantikbare `Avatar`'s met
  selectie-state. Vervangt de custom toewijzing/betaler/rotatie-pickers in
  `task/[id].js` en `expense/[id].js`.
- **`EmojiPicker`** — rij emoji-keuzes (huishouden-subgroep, onboarding, plant).
  Tikvlak ≥ `touchTarget`, `radius`-token i.p.v. hardcoded.
- **`PhotoPicker`** — foto kiezen/maken + spinner tijdens upload (plant); hergebruikt
  het patroon dat nu inline in `plant/[id].js` staat.
- **`ListSkeleton`** — eenvoudige laad-placeholder (een paar grijze `ItemRow`-vormen)
  i.p.v. abrupt inpoppen. Gebruik in de lijstschermen tijdens `loading`.

#### Files
**Gewijzigd:** `lib/ui.js` (+ docs-regel in `DESIGN.md` "Componenten"). **Gebruikt
in:** task/expense/plant-editors, `huishouden.js`, `onboarding.js`, lijstschermen.

---

## Thema C — Helderheid van bediening

### STR-5 — Zichtbare item-acties + één primaire actie per scherm

#### Aanpak
- **Vervang verborgen long-press-delete** (nu in `boodschappen.js`, en subgroep-
  delete in `huishouden.js`) door een **zichtbare** actie: swipe-to-delete via
  `react-native-gesture-handler` `Swipeable` (al een dependency) met een rode
  achtergrond + prullenbak-icoon, óf een trailing `IconButton`. Combineer met de
  undo-toast uit STR-9 zodat verwijderen vergeeflijk is.
- **Eén duidelijke primaire actie per scherm**: Boodschappen-`+` als `FAB` of
  volwaardige `Button` (nu zwakke oranje `TouchableOpacity`); de absoluut
  gepositioneerde "Weekschema opzetten" op `schoonmaak.js` netjes in de flow of als
  `Empty`-actie wanneer er nog geen rooster is.

#### Files
**Gewijzigd:** `app/(tabs)/boodschappen.js`, `app/(tabs)/schoonmaak.js`,
`app/(tabs)/huishouden.js`; eventueel een dunne `SwipeRow`-wrapper in `lib/ui.js`.

### STR-6 — Inline formulier-validatie

#### Aanpak
De `Field`-component ondersteunt al een `error`-prop (`lib/ui.js`), maar geen editor
gebruikt 'm. Vervang blokkerende `Alert.alert`-validaties in `task/[id].js`,
`expense/[id].js` en `app/(auth)/welcome.js` door per-veld `error`-teksten (de
foutmelding wordt al voorgelezen via `accessibilityLiveRegion`). Houd `Alert` alleen
voor echte bevestigingen (verwijderen), niet voor validatie.

#### Files
**Gewijzigd:** `app/task/[id].js`, `app/expense/[id].js`, `app/(auth)/welcome.js`.

---

## Thema D — Interactie-feel

### STR-7 — Optimistic UI

#### Waarom
Grootste winst voor "snel voelen": nu verandert er niets op het scherm tot de
Supabase-roundtrip klaar is. Op 4G voelt elke tik traag.

#### Aanpak
Werk de lokale state direct bij, sync daarna, rollback bij fout. Centrale plek:
`lib/useCollection.js` (`create`/`update`/`remove`) — dekt in één klap de meeste
modules. Specifiek `lib/useTasks.js` (`completeTask`/`uncompleteTask`) en
`lib/useGroceries.js` (`toggle`/`clearChecked`). Patroon: optimistisch muteren →
`mutate(...)` → bij error de oude state terugzetten + (STR-9) een foutmelding.
Realtime-subscriptions corrigeren alsnog naar de serverwaarheid.

#### Files
**Gewijzigd:** `lib/useCollection.js`, `lib/useTasks.js`, `lib/useGroceries.js`
(en hooks die op `useCollection` leunen erven het gratis).

### STR-8 — Haptics

#### Aanpak
`expo-haptics` is al geïnstalleerd. Voeg een dun wrappertje toe (`lib/haptics.js`:
`tapLight()`, `success()`, `error()` — no-op op web) en roep het aan bij afvinken
(licht), opslaan/voltooien (success) en validatiefouten (error). Eén plek, overal
hergebruikt. Respecteer dat het op web/zonder hardware stilletjes niets doet.

#### Files
**Nieuw:** `lib/haptics.js`. **Gewijzigd:** afvink-/opslaan-handlers (TaskRow,
boodschappen, editors).

### STR-9 — Toast + ongedaan-maken

#### Waarom
`DESIGN.md` principe 7 ("vergevingsgezind"): vernietigende acties zonder vangnet
(boodschap verwijderen, "afgevinkte wissen") botsen daarmee.

#### Aanpak
Een lichte in-house **toast met optionele "Ongedaan maken"-actie** (een context +
component in `lib/ui.js`, gevoed via een provider in `app/_layout.js`). Bij
verwijderen: toon de toast, en voer de echte delete pas uit ná de undo-window (of
herstel bij undo). Voor acties die niet teruggedraaid kunnen worden: een
bevestiging via `Alert`. Sluit aan op STR-5 (swipe-delete) en STR-8 (haptics).

#### Files
**Nieuw:** toast-component + provider in `lib/ui.js` / `lib/toast.js`. **Gewijzigd:**
`app/_layout.js` (provider), `app/(tabs)/boodschappen.js` en andere delete-flows.

---

## Thema E — Empty states, beweging & vieren

### STR-10 — Empty states overal met next-step

#### Aanpak
De `Empty`-component (met `actionTitle`/`onAction`) staat al goed op Vandaag/Taken.
Loop de overige schermen na (Boodschappen, Kosten, Planten, Agenda, Schoonmaak,
Huishouden-subgroepen) en geef elke lege staat een **volgende stap** i.p.v. een dood
einde (bv. "Nog geen boodschappen — voeg er een toe", "Nog geen rooster — zet een
weekschema op"). Zo voelt een leeg scherm uitnodigend, niet kaal.

#### Files
**Gewijzigd:** de lijstschermen onder `app/(tabs)/` die nog een bare/missende lege
staat hebben.

### STR-11 — Beweging via `motion`-tokens

#### Aanpak
De `motion`-tokens (`lib/theme.js`) worden nergens gebruikt. Voeg lichte, zachte
beweging toe: lijst add/remove via `LayoutAnimation` (configureer met
`motion.fast/base`), en een kleine "vier-de-voortgang"-animatie bij afvinken (schaal/
fade op de checkbox). **Respecteer "verminder beweging"** (`AccessibilityInfo
.isReduceMotionEnabled()`) — sla animaties dan over. Klein houden; geen confetti-regen.

#### Files
**Gewijzigd:** `lib/TaskRow.js` (afvink-animatie), lijstschermen (`LayoutAnimation`
rond mutaties), eventueel een helper in `lib/ui.js`.

---

## Aanbevolen volgorde binnen Fase 1.5
1. **STR-1 / STR-2** (IA) — bepaalt het frame waar de rest in past.
2. **STR-7 / STR-8 / STR-9** (feel-quick-wins) — hoog-impact, klein; verbetert alles ineens.
3. **STR-3 / STR-4** (cohesie) — de zichtbare opschoning.
4. **STR-5 / STR-6** (helderheid).
5. **STR-10 / STR-11** (empty/beweging) — de laatste laag glans.

Commit per logische stap; draai `npm test` (units onveranderd groen — dit raakt geen
pure logica). Doe na elk thema een korte handmatige rooktest op web.

## Acceptatiecriteria
- **Cohesie:** geen rauwe `TouchableOpacity` of hardcoded `padding/gap/borderRadius/
  fontSize` meer in de aangepakte schermen; alles uit `lib/ui.js` + tokens. (Snelle
  check: `grep -rn "TouchableOpacity" app/` daalt fors.)
- **Feel:** afvinken/toevoegen verandert het scherm **direct** (optimistic); een
  fout rolt netjes terug. Haptisch signaal bij afvinken/opslaan/fout (op toestel).
- **Vergevingsgezind:** een boodschap verwijderen geeft een undo-toast; "afgevinkte
  wissen" vraagt bevestiging of is terug te draaien.
- **Validatie:** een leeg verplicht veld toont een **inline** fout onder dat veld,
  geen blokkerende `Alert`.
- **IA:** Agenda en Schoonmaak lezen zichtbaar als weergaven op dezelfde taken; een
  taak afvinken in het ene scherm werkt het andere bij; "nieuwe taak" vanuit
  Schoonmaak/Agenda heeft de juiste context voorgevuld.
- **Empty/beweging:** elke lege lijst biedt een volgende stap; lijst-mutaties en
  afvinken animeren zacht en respecteren "verminder beweging".
- `npm test` blijft groen.
