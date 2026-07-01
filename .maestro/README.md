# Maestro E2E-flows (INF-3)

End-to-end-rooktests voor de kritieke flows, bovenop de pure units (`tests/`). Black-box
via de accessibility-/testID-laag — gekozen boven Detox om de lichte YAML-opzet (zie plan 08 fase D).

Draai ze niet los, maar via de **error-bewuste runner** `npm run rooktest` (start ook
logcat-capture en geeft één pass/fail-oordeel). Volledige procedure: [`../docs/rooktest.md`](../docs/rooktest.md).

## Vereisten
- [Maestro](https://maestro.dev) geïnstalleerd (`curl -fsSL https://get.maestro.mobile.dev | bash`).
- Een **development build** op een toestel/emulator (zie [`../docs/eas-setup.md`](../docs/eas-setup.md)),
  of de app draaiend via `npm run device`.
- Een **ingelogd test-huishouden** (de flows starten op de tabbalk; ze dekken niet
  de auth-/onboarding-flow — die vereist een wegwerp-account en e-mailbevestiging).

## Draaien
```sh
npm run rooktest                        # alle flows + logcat-oordeel (aanbevolen)
maestro test .maestro/                  # alleen de flows, kaal
maestro test .maestro/01-taak.yaml      # één flow
maestro studio                          # interactief selectors kalibreren
```

## Selectors — id boven tekst
Waar een flow een control aantíkt gebruiken we een **`id:`** (`t-…`), niet de NL-tekst,
zodat een copy-wijziging de flow niet breekt (dit beet ons: "Opslaan" vs "Bewaar" voor
dezelfde save-knop). De id's zitten op de gedeelde componenten in [`../lib/ui.js`](../lib/ui.js)
en de tabs in [`../app/(tabs)/_layout.js`](../app/(tabs)/_layout.js):

| id | element |
|----|---------|
| `t-tab-<key>` | tab-knop (key uit `lib/modules.js`, bv. `t-tab-taken`) |
| `t-save` / `t-cancel` | de bevestig-/annuleer-knop van élke editor (`ModalHeader`) |
| `t-fab-task` / `t-fab-expense` / `t-fab-vehicle` | "toevoegen"-FAB per module |
| `t-field-title` / `t-field-amount` / `t-field-description` | editor-velden |
| `t-grocery-add` | het boodschap-invoerveld |
| `t-error-boundary` | de error-boundary-fallback (voor `assertNotVisible`) |

`assertVisible` op zichtbare **inhoud** (bv. "E2E rooktest taak") blijft op tekst — dat is
juist wat we verifiëren. Elke flow eindigt met `assertNotVisible: id=t-error-boundary`.

## Flows
- `00-crash-sweep.yaml` — boot élk hoofdscherm (tabs + "Meer") en assert dat er geen render-fout valt.
- `01-taak.yaml` — taak toevoegen → terug in de lijst → afvinken.
- `02-uitgave.yaml` — uitgave toevoegen (via "Meer" → Kosten), gelijk gesplitst → terug in het overzicht.
- `03-boodschap-undo.yaml` — boodschap toevoegen → verwijderen (veeg links) → **ongedaan maken** (STR-9).
- `04-swipe.yaml` — veeg-acties op een taak (rechts = uitstellen, links = verwijderen), beide met undo.
  Op toestel geverifieerd (moto g72, 2026-06-23).

## Calibratie
De flows draaiden nog niet allemaal tegen een build; loop een nieuwe/gewijzigde flow de
eerste keer met `maestro studio` na en stel selectors zo nodig bij (vooral of "Meer" de
module opent en `back`/heropenen netjes terugkeert in de crash-sweep).
