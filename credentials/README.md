# EAS Submit-credentials

Deze map bevat de geheime sleutels waarmee EAS Submit naar de stores uploadt.
**Niets hier (behalve dit bestand) wordt gecommit** — zie [`.gitignore`](../.gitignore).
De paden hieronder staan al ingevuld in [`eas.json`](../eas.json) → `submit`.

## iOS — App Store Connect API-key ✅ compleet (2026-07-06)

Bestand: `asc-api-key.p8` (aanwezig, gitignored). `eas.json` → `submit.production.ios` is volledig
ingevuld: `ascApiKeyId` `LBMNK76NT6`, `ascApiKeyIssuerId` `2eaabb09-…`, `ascAppId` `6787762811`
(App Store Connect-app `Huishoek` aangemaakt). Geen `REPLACE_`-placeholders meer → `eas submit -p ios`
is klaar zodra er een build is. (Key ID/Issuer ID/App ID zijn identifiers, geen geheimen; alleen de
`.p8` is dat en die staat buiten git.)

**Zo (opnieuw) aan te maken / te vervangen:**
1. App Store Connect → **Users and Access → Integrations → App Store Connect API**.
2. Maak een key met rol **App Manager**, download de `.p8` (kan maar één keer!).
3. Leg 'm hier neer als `asc-api-key.p8` en vul in `eas.json`:
   - `ascApiKeyId` → de **Key ID** (10 tekens; = de `AuthKey_<KeyID>.p8`-bestandsnaam).
   - `ascApiKeyIssuerId` → de **Issuer ID** bovenaan de Keys-pagina (UUID, per account).
   - `ascAppId` → het **App-ID** (numeriek) van de app in App Store Connect → App Information.

## iOS — APNs push-key ✅ aangemaakt & geüpload (2026-07-06)

**Status:** APNs auth-key **`2982HKDV22`** (Team `J3DDDK3JB2`) — *Sandbox & Production*, *Team Scoped
(All Topics)* — is aangemaakt in Apple Developer en geüpload naar EAS (`eas credentials` → iOS →
profiel `production` / bundle `app.huishoek` → Push Notifications). EAS bewaart de `.p8` server-side; hij
staat **niet** in de repo. Team-scoped ⇒ dezelfde key dekt ook `app.huishoek.dev`/`.preview`. **Nog niet
end-to-end bevestigd** — dat kan pas met een echte iOS-device/TestFlight-build (Expo-push → APNs).

Push draait via Expo's push-service, die aan de iOS-kant deze APNs-key gebruikt. FCM blijft alleen voor
Android (`google-services.json`). **Zo (opnieuw) aan te maken / te vervangen** (max 2 keys per account —
één team-scoped key volstaat voor alle apps):

1. Apple Developer → **Certificates, Identifiers & Profiles → Keys** → nieuwe key met **Apple Push
   Notifications service (APNs)** aangevinkt (Configure → *Sandbox & Production* + *Team Scoped*);
   download de `.p8` (kan maar één keer!) en noteer de **Key ID**.
2. Upload 'm naar EAS-credentials: `eas credentials` → platform **iOS** → *Push Notifications: Manage
   your Apple Push Notifications Key* (EAS bewaart 'm; er komt geen bestand in deze repo).
3. Verifieer de staat met `eas credentials` (iOS) vóór je concludeert dat push werkt — de key kan er al
   staan zonder dat de repo dat laat zien.

## Android — Google Play service-account

Bestand: `google-play-service-account.json`

1. Google Cloud Console → **IAM & Admin → Service Accounts** → nieuwe service account → JSON-key downloaden.
2. Play Console → **Setup → API access** → de service account linken en **release-rechten** geven.
3. Leg het JSON-bestand hier neer als `google-play-service-account.json`.

## Gebruik

```bash
# Intern testen (Android internal track — geen 12-testers/14-dagen-eis):
eas build  -p android --profile production
eas submit -p android --profile internal --latest

# Echte release (zodra Play production-toegang + Apple Developer rond zijn):
eas build  -p ios     --profile production && eas submit -p ios --latest      # → TestFlight → review
eas submit -p android --profile production --latest                            # track: production, releaseStatus: draft

# iOS smoke-testen zónder Apple-signing (simulator-build; dev-profiel heeft ios.simulator:true):
eas build  -p ios     --profile development                                    # → daarna via expo:eas-simulator of `eas build:run -p ios --latest`
```

> **iOS-readiness — de volledige uitgestelde checklist** (APNs hierboven, submit-creds hierboven, plus
> app-icoon/splash, universal-links-herdeploy en de reality-check-cadans) staat in
> [`docs/plans/25-ios-readiness.md`](../docs/plans/25-ios-readiness.md). Status: backlog §6 rij **IOS-1**.
