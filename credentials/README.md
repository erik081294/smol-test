# EAS Submit-credentials

Deze map bevat de geheime sleutels waarmee EAS Submit naar de stores uploadt.
**Niets hier (behalve dit bestand) wordt gecommit** — zie [`.gitignore`](../.gitignore).
De paden hieronder staan al ingevuld in [`eas.json`](../eas.json) → `submit`.

## iOS — App Store Connect API-key

Bestand: `asc-api-key.p8`

1. App Store Connect → **Users and Access → Integrations → App Store Connect API**.
2. Maak een key met rol **App Manager**, download de `.p8` (kan maar één keer!).
3. Leg 'm hier neer als `asc-api-key.p8` en vul in `eas.json`:
   - `ascApiKeyId` → de **Key ID** (10 tekens) naast de key.
   - `ascApiKeyIssuerId` → de **Issuer ID** bovenaan de Keys-pagina.
   - `ascAppId` → het **App-ID** (numeriek) van de app in App Store Connect → App Information.

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
```
