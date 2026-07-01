# Rooktest-runbook — snel & geautomatiseerd op een echt toestel

De rooktest verifieert "draait de app en crasht 'ie nergens?" op een écht toestel, zonder
handmatig door de UI te tikken en screenshots te lezen. [Maestro](https://maestro.dev)
navigeert zelf door de kritieke flows, assert't op zichtbare tekst/`id`'s en maakt **alléén
bij een fout** een screenshot/video. De runner [`scripts/rooktest.sh`](../scripts/rooktest.sh)
vangt daarnaast `adb logcat` af en geeft één kort pass/fail-oordeel.

Op groen hoef je dus niets te bekijken; op rood wijst de runner je naar het faalmoment.

## De drie stappen

1. **Terminal 1 — toestel + app live:**
   ```sh
   npm run device
   ```
   Wacht tot de app cold-geladen is en log in op het **test-huishouden** (erik@evdn.nl,
   zie de test-credentials). De flows starten op de tabbalk, niet op de auth-/onboarding-flow.

2. **Kalibreer een nieuwe/gewijzigde flow één keer** (overslaan als niets veranderde):
   ```sh
   maestro studio
   ```
   Bevestig de `id:`-selectors (zie [`../.maestro/README.md`](../.maestro/README.md)).

3. **Terminal 2 — draai de rooktest:**
   ```sh
   npm run rooktest                      # alle flows in .maestro/
   npm run rooktest -- .maestro/00-crash-sweep.yaml   # één flow
   ```

## Wat de runner doet

- Zet `node`/`adb`/`maestro` op PATH en verifieert het toestel (zelfde herstel-schop als
  `npm run device`).
- Leegt de logcat-buffer en streamt `adb logcat` naar een logbestand tijdens de run.
- Draait `maestro test` (JUnit-rapport). Maestro faalt zelf zodra een `assertVisible`
  time-out — dat is het primaire signaal.
- Grep't logcat op harde fouten (`FATAL EXCEPTION`, `E ReactNativeJS`,
  `Unhandled promise rejection`, `Render Error`) als vangnet voor een fout die het scherm
  niet breekt maar wel logt.

## Exit-codes & artefacten

- **exit 0** — alle flows groen én logcat schoon.
- **exit 1** — een flow faalde óf logcat toonde een harde fout (geschikt om later in CI te gaten).

De runner print de paden:
- **rapport** (`report.xml`) en **logcat** (`logcat.txt`) in `$TMPDIR/huishoek-rooktest/<timestamp>/`;
- **screenshots/video bij falen** in `~/.maestro/tests/<laatste>/`.

Crashes in een echte build landen daarnaast in **Sentry** (`de.sentry.io/evdn/huishoek`, zie
[`eas-setup.md`](./eas-setup.md)); logcat is de dev-run-tegenhanger.

## Flows

Zie [`../.maestro/README.md`](../.maestro/README.md) voor de flow-lijst, de `id:`-conventie
(`t-…`) en de calibratie-tips.
