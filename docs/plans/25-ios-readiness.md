# Plan 25 — iOS-readiness: een spijtvrije route uit de Android-monocultuur

> **Soort:** platform/testroute-strategie · **Backlog:** IOS-1 (§6) · **Migratie:** nee
> **Status leeft in [backlog §6](../../huishoek-backlog.md).** Dit doc is de rationale + build-ready
> checklist, geen status.

## Waarom

We ontwikkelen en testen in een **Android-monocultuur**: Maestro-rooktest, `dev-device.sh` en
`npm run device` zijn volledig Android (`adb`/`logcat`/`uiautomator`); de unit-tests zijn
platform-neutrale pure JS; CI draait op `ubuntu-latest` zonder macOS/simulator/`eas build`. Er is
**nooit een `ios/`-prebuild gegenereerd** — alleen `android/` bestaat. **Nul testlagen raken iOS.**

De doelstelling is een route **zonder spijt**: geen dubbel onderhoud (twee apps beheren) tijdens het
doorontwikkelen, maar ook niet over enkele maanden voor een onmogelijke iOS-ready-opgave staan.

**Kernthese.** De "onmogelijk later"-berg komt **niet** uit de config-checklist (permissie-strings,
icoon, APNs, submit-creds) — dat is een begrensde klus van ±1 dag zonder compounding. De berg komt uit
**ongecontroleerd stapelende, alleen-op-Android-bewezen platform-divergente code**. Nooit kijken = een
muur van gelijktijdig-kapotte layout/gesture/keyboard-bugs op de dag dat je iOS-ready wilt, zonder te
weten welke wijziging welke bug veroorzaakte. **Spijtvrije zet:** doe nu alleen de goedkope
observability-enabler, zet een **lichte periodieke reality-check** op (géén per-PR-CI → geen dubbel
onderhoud), en documenteer de rest als bewust uitgestelde livegang-checklist.

## Geverifieerde aannames (2026-07-05)

Getoetst tegen de echte config/live-host, niet uit geheugen:

1. **Geen first-tap crash.** `npx expo config --type introspect` toont dat de opgeloste iOS `Info.plist`
   de camera/foto-`UsageDescription`-keys **wél** bevat, óók toen `expo-image-picker` niet in `plugins`
   stond: **Expo SDK 56 (`expo ^56.0.12`) past module-config-plugins auto toe.** Zonder eigen copy zijn
   het Engelse defaults → lokalisatie-/App-Review-frictie, geen crash. (Bevestigt INF-5 in de
   [app-review](../reviews/2026-07-02-app-review.md).)
2. **Live universal links zijn dood.** `https://huishoek.app/.well-known/apple-app-site-association`
   serveert live nog `REPLACE_APPLE_TEAM_ID.app.huishoek` — de placeholder-fix in `public/` (commit met
   `J3DDDK3JB2`) is nog niet ge-deployed. (Zelfde restpunt als REV-2 §P8.)
3. **"EAS cloud-simulator" is experimenteel.** Reguliere Expo-docs kennen alleen een *lokale* simulator
   (`ios: { simulator: true }`-build + `eas build:run`); de cloud/remote sim loopt via de experimentele
   `expo:eas-simulator`-tooling. De buildsleutel `ios: { simulator: true }` is bevestigd correct.

**Netto:** iOS bouwt en draait waarschijnlijk gewoon; er is geen verborgen crash-blokkade. De echte,
niet-waarneembare-tot-je-bouwt risico's zijn de UI-divergentie (compounding), push/APNs, auth-deep-links
en lokalisatie.

## Nu gedaan (in deze ronde) — de enabler

- [`eas.json`](../../eas.json): `development`-profiel kreeg `ios: { simulator: true }` → er kan voor het
  eerst een simulator-draaibare iOS-build ontstaan. Raakt de Android-builds niet.
- [`app.config.js`](../../app.config.js): `expo-image-picker`-plugin expliciet gelijst met **NL** camera/
  foto-permissieteksten (overschrijft de Engelse auto-defaults). Introspect-geverifieerd.

## Nog te doen — de eerste iOS-build (device-gated, buiten deze ronde)

Vergt EAS-login + build-credits, dus bewust niet auto-getriggerd:
1. `eas build -p ios --profile development` (simulator-build; **geen** Apple-signing nodig).
2. Draaien via de **`expo:eas-simulator`**-skill (cloud-sim; experimenteel + credits) — of op een Mac met
   Xcode gratis via `eas build:run -p ios --latest` op de lokale Simulator.
3. **Smoke-basislijn** langs de hotspots (zie onder). Uitkomst loggen in
   [`huishoek-voortgang.md`](../../huishoek-voortgang.md).

## Cadans — de lichte reality-check

Géén macOS-runner/Maestro-iOS op elke PR (dát is het dubbele onderhoud dat we vermijden). Wél een
**handmatige EAS(-cloud)-simulator smoke-pass**, getriggerd door (a) elke milestone / vóór een
release-candidate, én (b) direct ná het aanraken van een divergentie-hotspot. Zo blijft iOS-divergentie
klein en toewijsbaar aan één wijziging.

## De divergentie-hotspots (waar de reality-check op let)

Alleen-op-Android-bewezen codepaden die op iOS wezenlijk anders zijn:
- **`presentation:'modal'` (16 schermen, [`app/_layout.js`](../../app/_layout.js)) + `pageSheet`**
  ([`app/(tabs)/huishouden.js`](../../app/(tabs)/huishouden.js)): iOS-kaart/sheet met swipe-omlaag-dismiss +
  partiële hoogte; Android negeert `pageSheet`. **Grootste blinde vlek.**
- **`KeyboardAvoidingView behavior='padding'`** (iOS-tak, 6 plekken incl. [`lib/ui.js`](../../lib/ui.js)
  regels 930/1090) — de tak die op iOS berucht misgaat; erger binnen de `pageSheet`.
- **iOS-systeemgestures** (edge-swipe-back impliciet aan; geen `gestureEnabled`) vs. `SwipeRow`,
  taken/maaltijden-pans, `BottomSheet`- en `PeriodPicker`-pans → conflicten.
- **Schaduwen** ([`lib/theme.js`](../../lib/theme.js) 71-87): iOS rendert uit `shadow*`-props die Android
  negeert (Android = enkel `elevation`) → raakt elke Card/sheet/dialog/FAB.
- Kleiner: `statusBarTranslucent` (Android-only, no-op iOS) in [`lib/dialog.js`](../../lib/dialog.js)/
  `BottomSheet`; Dynamic-Island/notch-insets in de `vandaag.js` autoscroll; `RefreshControl tintColor`
  (iOS-only); haptische feel; SecureStore=Keychain (chunking op de Android-bytelimiet).

Structureel al goed (geen actie): eigen `PeriodPicker` (geen native datetimepicker-divergentie), eigen
`lib/dialog.js` (geen `Alert`/`ActionSheetIOS`), geen `.ios.js`/`.android.js`-varianten, en de
permissie-strings zijn aanwezig (geen crash).

## Bewust uitgesteld tot livegang (begrensde klus, geen compounding)

Zie de iOS-checklist in [`credentials/README.md`](../../credentials/README.md) voor de creds-kant:
- **APNs-push**: APNs-key naar EAS uploaden (FCM is nu Android-only; iOS-push levert tot dan vermoedelijk
  niets). Verifieer de daadwerkelijke staat met `eas credentials` — APNs-creds leven server-side, niet in
  de repo.
- **iOS-submit-credentials**: de 3 `REPLACE_*` in `eas.json` `submit.production.ios` + `asc-api-key.p8`.
- **App-icoon + splash-image** (nu default Expo-assets; blokkeert alleen een *store*-build). INF-5.
- **Universal-links herdeploy**: `npm run deploy:web` met de ingevulde Team ID → activeert iOS universal
  links; overweeg `.dev`/`.preview`-bundles aan de AASA toe te voegen. (REV-2 §P8.)
- **Native auth-deep-links**: herstel/e-mailbevestiging redirecten nu naar web i.p.v. de app (TODO in
  [`app/herstel.js`](../../app/herstel.js) 18-24).
- **Productie/preview iOS-buildprofielen** in `eas.json`.

## File-checklist

- [x] `eas.json` — `ios.simulator` op `development`.
- [x] `app.config.js` — `expo-image-picker`-plugin met NL-copy.
- [x] `huishoek-backlog.md` §6 — rij IOS-1.
- [x] `credentials/README.md` — APNs-sectie + uitgestelde iOS-checklist.
- [x] `docs/rooktest.md` — iOS-smoke-notitie.
- [ ] Eerste `eas build -p ios --profile development` + smoke → log in `huishoek-voortgang.md`.

## Acceptatie

- Introspect toont NL camera/foto-`UsageDescription` (✓ 2026-07-05).
- `eas build -p ios --profile development` accepteert de simulator-tak.
- Eerste smoke-pass bewijst: app bouwt+start op iOS, foto-prompt werkt (geen crash), een modal opent als
  iOS-sheet + swipe-dismiss, KAV verbergt het actieve veld niet, schaduwen/pull-to-refresh ogen oké.
