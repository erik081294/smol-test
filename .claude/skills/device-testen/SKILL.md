---
name: device-testen
description: Een wijziging verifiëren of rooktesten op het USB-Android-toestel (moto) of een branch/worktree live testen via de dev-client. Gebruik deze skill vóór je adb/Metro/Maestro aanraakt. Trefwoorden: rooktest, smoketest, toestel, device, adb, Maestro, deeplink, screenshot, dev-client, Metro, worktree.
---

# Testen op het toestel

Twee routes — kies bewust:

1. **Geautomatiseerd oordeel (default):** `npm run rooktest` — deeplink-crash-sweep langs alle
   hoofdschermen + Maestro-flows + logcat, één pass/fail. Runbook: [docs/rooktest.md](../../../docs/rooktest.md).
2. **Handmatig/gericht:** dev-client + Metro + deeplinks (hieronder). Alleen als je iets
   specifieks wilt zien dat de flows niet dekken.

## De gouden regels (kostten ons eerder halve dagen)

- **Gebruik ALTIJD `app.huishoek` (de dev-client), nooit `app.huishoek.preview`.** De
  preview/standalone APK draait een bevroren, ingebakken bundle en negeert Metro volledig —
  force-stop "verfrist" niets, je kijkt eindeloos naar oude code. Check bij twijfel:
  `adb shell dumpsys window | grep mCurrentFocus`.
- **Metro alléén op poort 8081** + `adb reverse tcp:8081 tcp:8081`. Een tweede Metro op een
  andere poort remappen werkt niet (Metro `--localhost` bindt IPv6, adb reverse forwardt IPv4
  → "Unable to load script"). Andere checkout serveren? Kill de bestaande Metro en start de
  jouwe op 8081. Geen `CI=1` (zet HMR uit).
- **Navigeer via deeplinks, niet door de UI tikken** (afspraak met de gebruiker; veel sneller).
- **Opruimen na afloop:** kill je Metro, verwijder je worktree, en herstart Metro vanuit de
  hoofd-checkout — anders crasht de app op de volgende launch.

## Setup

```bash
# adb staat niet op PATH: export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH"
# Java (Maestro/Gradle): Android Studio's JBR (JAVA_HOME staat in .claude/settings.local.json)
npm run device        # scripts/dev-device.sh: Metro --localhost + adb reverse + cold-load
adb shell svc power stayon usb   # voorkomt doze/zwarte screenshots tijdens lange sessies
```

**Vanuit een git worktree** (branch-integraties testen): de worktree mist gitignored bestanden —
`cp ../smol-test/.env <worktree>/.env` (EXPO_PUBLIC_* wordt bij bundle-tijd ingebakken → Metro
met `--clear` starten) en `ln -s ../smol-test/node_modules node_modules` (geen trage `npm ci`).

## Deeplinks

Scheme `huishoek`; group-segmenten `(tabs)`/`(auth)` vallen weg. Omdat de preview-build het
scheme mee-claimt: richt expliciet op de dev-client:

```bash
adb shell am start -a android.intent.action.VIEW -d "huishoek://<route>" -n app.huishoek/.MainActivity
```

- **Cold-load van de bundle:** `huishoek://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`
- **Tabs:** `vandaag` `taken` `boodschappen` `kosten` `maaltijden` `planten` `huisdieren`
  `voertuigen` `schoonmaak` `voorraad` `inzichten` `tijdlijn` `delen` `huishouden`
  `instellingen` `assistent` `meer`
- **Top-level:** `catalog` `herinneringen` `kosten-inzichten` `beeldstijl` `onboarding` `zoeken` `purchases`
- **Detail/editor (id of `new`):** `plant/…` `pet/…` `vehicle/…` `recipe/…` `task/…`
  `expense/…` `recurring-expense/…` `purchase/…` `resource/…` `product/…` `tijdlijn/…`
- Verifieer een route bij twijfel tegen de actuele boom: `app/(tabs)/*.js` + `app/**/*.js`
  (route = pad zonder `(group)` en `.js`).

## Alleen tikken als het moet

`adb shell uiautomator dump /sdcard/ui.xml` → pull → parse `bounds` uit de **rauwe** XML →
`adb shell input tap X Y`. **Her-dump per scherm** — dezelfde knop zit via een ander entry-point
op een andere y; een hergebruikt coördinaat tikt de backdrop (lijkt op een save-bug, is een
tap-miss). Screenshot: `screencap -p /sdcard/s.png` + `adb pull` (niet exec-out); verkleinen
met `sips -Z 900`. Lege dump/zwart screenshot = display doze → `input keyevent KEYCODE_WAKEUP`.

## `npm run rooktest` — weetjes

- Maestro staat in `~/.maestro/bin` en heeft Java nodig; de runner valt terug op Android
  Studio's JBR als `JAVA_HOME` leeg is.
- Flows draaien sequentieel met een deeplink-reset ertussen; niet `maestro test .maestro/`
  (parallelliseert). Selectors op `t-*` testID's, geen NL-teksten.
- Ruist logcat met `uiautomator`/`UiAutomation` FATAL's: dat is de bekende botsing met
  Maestro's accessibility-connectie, geen app-crash.
- Cleanup gaat op DB-niveau (`scripts/rooktest-cleanup.mjs`, verwijdert `E2E%`-rijen).

## Lokale dev-build (alleen nodig bij een nieuwe native module)

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"; export ANDROID_SDK_ROOT="$ANDROID_HOME"
npx expo run:android    # ~10 min eerste keer; daarna snel door de gradle-cache
```

- `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (signature-conflict met de EAS-build):
  `adb uninstall app.huishoek` en opnieuw installeren (wist alleen lokale login/prefs).
- Prebuild genereert `/android` (gitignored) én herschrijft de `android`/`ios` npm-scripts —
  draai `package.json` terug met `git checkout -- package.json`.
- In de dev-client geeft `Appearance.getColorScheme()` altijd `'light'` — het 'Systeem'-thema
  is dáár niet te verifiëren, de handmatige Licht/Donker-keuze wél.

## Test-login

E-mail `erik@evdn.nl`; het wachtwoord staat bewust níét in de repo — vraag de gebruiker of
gebruik de lokale sessie-memory. Let bij `adb shell input text` op shell-escaping van
speciale tekens.
