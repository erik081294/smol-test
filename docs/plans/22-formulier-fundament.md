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
1. Migreer de 6 overige incrementeel-editors naar full-mode + onBlur-live-validatie:
   uitgave, recept, voertuig, huisdier, plant, bon.
2. `<DynamicList>` — gedeelde dynamische regellijst voor bon + recept (nu elk hand-gebouwd).
3. Gedeeld foto-veld + loading/skeleton-helpers (plant/voertuig/recept/product).
