# Plan 22 — Formulier-fundament (ARCH-5)

**Status:** pilot gebouwd (2026-07-01), device-rooktest open. Zie backlog §6 **ARCH-5**.

## Aanleiding

De app is volwassen op fundament-niveau, maar invoer voelt als *"eindeloze formuliertjes
overal — niet verfijnd of gebruiksvriendelijk"*. De bouwstenen zijn goed (gedeelde
`useEntityForm` + pure `formValidation` + `Editor`/`Field`/`Collapsible`/`BottomSheet`,
contract in DESIGN.md); de **compositie** schuurde:

- 7 van de 9 editors stonden in `useEntityForm`-**incrementeel-mode**: ~20 losse `useState` +
  handmatige `buildSnapshot()`-dirty per scherm.
- **Validatie pas bij "Bewaar"** — fouten als muur i.p.v. inline meegroeien.
- **Verborgen sub-forms** achter losse tekstlinks (beschrijving, herhaal-einde).

Richting (met de gebruiker afgestemd): **fundament eerst, bewezen via een diepe pilot op de
Taken-editor** (de zwaarste). De uitrol naar de overige editors is de staart van dit plan.

## Gebouwd (fundament — gedragsneutraal, additief)

- **[`lib/formValidation.js`](../../lib/formValidation.js)** — pure helpers `firstErrorField(errors, order)`
  (naar welk veld scrollen) + `isDirty(current, baseline, serialize)` (discard-guard). Unit-getest;
  mutatie-ratchet 91,5%.
- **[`lib/useEntityForm.js`](../../lib/useEntityForm.js)** — full-mode: `dirty` (via optionele
  `serialize`), `reset(values)` (nieuw ijkpunt na async load), `validateField(rules, key)` (onBlur
  live-validatie voor één veld). Puur additief — de incrementeel-mode van de andere editors blijft.
- **[`lib/ui.js`](../../lib/ui.js)** — `useErrorScroll()` (registreert veld-y's, scrollt bij een
  gefaalde submit naar de eerste fout) + `RevealLink` (één "+ label"-affordance voor optionele velden).
  `Field` forwardt `onBlur` al via `...props` → geen wijziging nodig.

## Pilot — [`app/task/[id].js`](../../app/task/%5Bid%5D.js)

Herbouwd op het fundament: ~20 `useState` → hook-`values`; handmatige `buildSnapshot`/`initialSnap`
→ hook-`dirty` + `reset`; de twee ad-hoc onthul-links → `RevealLink`; onBlur-live-validatie op de
titel + scroll-naar-eerste-fout bij submit. **Onveranderd:** het `save()`-payload, de deep-link-params
(`date`/`zone`/`plant`), de verwijder-met-undo-flow en alle teksten. Referentie-implementatie voor de uitrol.

## Verificatie

- Automatisch (groen): `npm test` 820 pass / 0 fail / 23 skip · `npm run typecheck` · `npx eslint .` 0 errors ·
  mutatie-ratchet `formValidation` 91,5%.
- **Device-rooktest (open)** — moto via USB, live metro, deep-link `huishoek://task/new`:
  nieuwe taak (titel → opslaan), bestaande bewerken, herhaling aan → interval/weekdagen → einde,
  leeg opslaan → fout verschijnt + scrollt in beeld, dirty → discard-guard bij terug. 1-op-1 vergelijken
  met het oude gedrag (gedragsneutraliteit).

## Uitrol (staart — na de pilot)

Elk als eigen stap, hergebruikt het fundament:
1. ✅ **Gedaan (2026-07-01):** de 6 overige editors op full-mode + onBlur-live-validatie:
   uitgave (`expense`), bon (`purchase`), recept (`recipe`), plant, voertuig (`vehicle`), huisdier (`pet`).
   Elk ~15–26 losse `useState` → hook-`values` + `dirty` (genormaliseerde serialize) + `validateField`
   (onBlur); waar de velden verspreid staan ook scroll-naar-eerste-fout. **Nieuw t.o.v. de oude editors:**
   een discard-guard (die hadden ze nog niet). Voor **vehicle** (eigen `ModalHeader` i.p.v. `Editor`) is de
   guard geëxtraheerd naar de herbruikbare **`useDiscardGuard(dirty, onClose)`** in `lib/ui.js` (incl. Android
   hardware-back; `Editor` gebruikt 'm nu ook). Gedragsneutraal in payload/regels/deep-links. Groen: `npm test`
   820 pass / 0 fail, typecheck, `eslint .` 0 err, mutatie-ratchet ongewijzigd. **Device-rooktest van de 7
   editors open** (toestel bezet door de Maestro-automatisering) → ARCH-5 blijft 🔧.
2. ✅ **Gedaan (2026-07-01) — als gedeelde lijst-*logica*, niet als één UI-component.**
   Bij nadere inspectie verschillen bon en recept fundamenteel van interactiemodel: de **bon**-regels
   zijn inline-bewerkbare, index-gebaseerde kaarten (naam/aantal/eenheid/prijs + catalogus-koppeling),
   terwijl **recept**-ingrediënten een *key*-gebaseerde composer + los weergave-lijstje zijn (met
   suggesties, live-mutatie bij een bestaand recept). Eén gedeelde `<DynamicList>`-component zou een
   geforceerde abstractie zijn. Wél gedeeld — en het echte duplicaat — is de **array-*logica***: het
   `includes ? filter : [...]`-toggle-idioom (~9× over de editors) en de map/filter/spread-regelops.
   Die staan nu in het pure, geteste [`lib/listField.js`](../../lib/listField.js)
   (`toggleValue`/`addItem`/`removeAt`/`updateAt` — onveranderlijk, mutatie **100%**, in GROUPS +
   `tsconfig.check.json` + baseline) en zijn geadopteerd in task/expense/plant/pet/vehicle/recurring-expense
   (toggle) en purchase (regellijst). Gedragsneutraal.
3. Gedeeld foto-veld + loading/skeleton-helpers (plant/voertuig/recept/product). *(open — lagere prioriteit)*
