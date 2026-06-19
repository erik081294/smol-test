# Maestro E2E-flows (INF-3)

End-to-end-rooktests voor de kritieke flows, bovenop de pure units (`tests/`). Black-box
via de accessibility-laag — gekozen boven Detox om de lichte YAML-opzet (zie plan 08 fase D).

## Vereisten
- [Maestro](https://maestro.dev) geïnstalleerd (`curl -fsSL https://get.maestro.mobile.dev | bash`).
- Een **development build** op een toestel/emulator (zie [`../docs/eas-setup.md`](../docs/eas-setup.md)),
  of de app draaiend via `npx expo start --dev-client`.
- Een **ingelogd test-huishouden** (de flows starten op de tabbalk; ze dekken niet
  de auth-/onboarding-flow — die vereist een wegwerp-account en e-mailbevestiging).

## Draaien
```sh
maestro test .maestro/                 # alle flows
maestro test .maestro/01-taak.yaml     # één flow
maestro studio                          # interactief selectors kalibreren
```

## Let op — calibratie
Deze flows zijn geschreven tegen de zichtbare NL-teksten (`lib/i18n.js`) en
accessibility-labels zoals ze in de code staan, maar zijn **nog niet tegen een
draaiende build gevalideerd** (geen toestel beschikbaar tijdens het schrijven). Loop ze
de eerste keer met `maestro studio` na en stel selectors zo nodig bij. Overweeg
`testID`/`accessibilityLabel` toe te voegen waar tekst-matching te broos is.

## Flows
- `01-taak.yaml` — taak toevoegen → terug in de lijst → afvinken.
- `02-uitgave.yaml` — uitgave toevoegen, gelijk gesplitst → terug in het overzicht.
- `03-boodschap-undo.yaml` — boodschap toevoegen → verwijderen → **ongedaan maken** (STR-9).
