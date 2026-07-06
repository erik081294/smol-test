# Rooktest-runbook — snel & geautomatiseerd op een echt toestel

De rooktest verifieert "draait de app en crasht 'ie nergens?" op een écht toestel, zonder
handmatig door de UI te tikken en screenshots te lezen. Eén commando geeft één pass/fail-oordeel:

```sh
npm run rooktest                          # crash-sweep + alle behavior-flows
npm run rooktest -- .maestro/01-taak.yaml # één specifieke flow (geen sweep)
```

De runner ([`scripts/rooktest.sh`](../scripts/rooktest.sh)) doet twee dingen:

1. **Crash-sweep via deeplinks** — navigeert razendsnel (~1,5s/route) naar élk hoofdscherm
   met `huishoek://<route>` en assert via een `uiautomator`-dump dat de error-boundary-fallback
   (`t-error-boundary` uit [`lib/ErrorBoundary.js`](../lib/ErrorBoundary.js)) níét verschijnt.
   Geen UI-getik, puur "boot alles, crasht niets".
2. **Behavior-flows via [Maestro](https://maestro.dev)** — de kritieke interacties
   (taak/uitgave/boodschap/veeg) in [`.maestro/`](../.maestro/). Maestro navigeert zelf en maakt
   **alléén bij een fout** een screenshot/video. Op groen hoef je dus niets te bekijken.

Daarnaast streamt de runner `adb logcat` mee en grep't op harde JS/native-fouten
(`FATAL EXCEPTION`, `E ReactNativeJS`, …) als vangnet voor een crash die het scherm niet breekt.

## Precondities

- **Toestel via USB** + `npm run device` in een aparte terminal (Metro + reverse-tunnel + de
  dev-client-app cold-geladen).
- **Ingelogd test-huishouden** (erik@evdn.nl). De flows starten op de tabbalk, niet op de
  auth-/onboarding-flow.
- **Maestro** geïnstalleerd (`curl -fsSL https://get.maestro.mobile.dev | bash`) én een **JDK**:
  Maestro draait op de JVM. De runner valt automatisch terug op de JDK 17 die Android Studio
  meelevert (`/Applications/Android Studio.app/Contents/jbr/…`) als `JAVA_HOME` leeg is.

## Hoe de runner de app laadt (dev-client-eigenaardigheden)

- Maestro's eigen `launchApp` opent de **dev-client-launcher**, niet de JS-bundle — daarom
  cold-laadt de runner de app zelf via de Metro-deeplink en **wacht tot de tab-shell er staat**
  (niet blind slapen; een koude bundle-reload duurt soms 20-30s).
- Staat óók de **preview-build** (`app.huishoek.preview`) geïnstalleerd, dan claimt die het
  `huishoek://`-scheme mee → Android toont anders een "Openen met"-keuze. De runner richt de
  deeplink daarom expliciet op de dev-client-activity (`-n app.huishoek/.MainActivity`).
- Tussen flows reset de runner met een deeplink naar `huishoek://vandaag` (sluit een open
  modal, terug naar home) — snel, geen dure force-stop/reload per flow.

## Exit-codes & artefacten

- **exit 0** — sweep schoon, alle flows groen én logcat schoon.
- **exit 1** — een route/flow faalde óf logcat toonde een harde fout (geschikt voor CI later).

De runner print de paden: **logcat** + **JUnit-rapporten** in
`$TMPDIR/huishoek-rooktest/<timestamp>/`, en **screenshots-bij-falen** in
`~/.maestro/tests/<laatste>/`. Crashes in een echte build landen daarnaast in **Sentry**
(`de.sentry.io/evdn/huishoek`).

## Testdata — self-cleaning

De behavior-flows maken rijen aan met naam `E2E…`. De runner **ruimt die aan het eind zelf op
op DB-niveau** ([`scripts/rooktest-cleanup.mjs`](../scripts/rooktest-cleanup.mjs), via de
`SUPABASE_SERVICE_ROLE_KEY` uit `.env`) — dus geen accumulatie. Waarom op DB-niveau en niet via
de UI: de app verwijdert undo-toast-gestuurd (op een timer), wat na een editor-`router.back()`
niet betrouwbaar afvuurt. De cleanup is strikt gescoped op `… like 'E2E%'`; ontbreekt de
service-key, dan slaat 'ie over (en laten de flows hooguit een paar `E2E…`-rijen achter).

## Flows & selectors

Zie [`../.maestro/README.md`](../.maestro/README.md) voor de flow-lijst en de `id:`-conventie
(`t-…`, gezet op de gedeelde componenten in [`../lib/ui.js`](../lib/ui.js)).

## iOS — handmatige smoke (bewust géén deel van deze runner)

Deze runner is **Android-only** (`adb`/`uiautomator`/`logcat`/`am start`); een macOS-runner + iOS-Maestro
op elke PR zou het dubbele onderhoud opleveren dat we tijdens de Android-fase vermijden. iOS-observability
loopt daarom via een **lichte, periodieke handmatige smoke** op de (EAS-cloud-)simulator, niet via dit
script. Kort recept — volledige rationale in [`plans/25-ios-readiness.md`](plans/25-ios-readiness.md)
(backlog §6 **IOS-1**):

1. `eas build -p ios --profile development` (simulator-build; `development` heeft `ios.simulator:true`,
   geen Apple-signing nodig).
2. Draaien via de **`expo:eas-simulator`**-skill (cloud; experimenteel) — of gratis op een Mac met Xcode:
   `eas build:run -p ios --latest` op de lokale Simulator.
3. **Loop de divergentie-hotspots langs** (de dingen die op iOS afwijken en die Android nooit uitvoert):
   een `presentation:'modal'`-scherm (opent als iOS-sheet, swipe-omlaag-dismiss) + de `pageSheet` in
   `huishouden`; een formulier met `KeyboardAvoidingView behavior='padding'` (veld niet achter het
   toetsenbord); een fotoscherm (NL-permissie-prompt, geen crash); schaduwen + pull-to-refresh.

**Wanneer draaien:** bij elke milestone / vóór een release-candidate, én direct ná het aanraken van een
hotspot (modals, KAV, gestures, `lib/theme.js`-schaduwen, safe-area). Zo blijft iOS-divergentie klein en
toewijsbaar aan één wijziging.
