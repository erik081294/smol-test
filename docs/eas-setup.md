# EAS-setup — Android dev build & release (quickstart)

Hoort bij [`docs/plans/08-professioneel-hardening.md`](./plans/08-professioneel-hardening.md)
fase B + E. De config (`eas.json`, `expo-dev-client`) staat klaar; onderstaande stappen
vereisen een **Expo-account** (gratis) en — voor de submit — het **Play Console**-account.

> Voer de `eas`-commando's met node op PATH uit (zie projectgeheugen `node-on-path`).

## Eenmalig

```sh
npm i -g eas-cli                 # of: npx eas-cli ...
eas login                        # Expo-account
eas init                         # koppelt het project; zet extra.eas.projectId in app.config.js
```

## Secrets (Supabase-keys in de cloud-build)

`app.config.js` leest de keys uit `process.env` bij build-tijd. Lokaal komt dat uit `.env`;
voor EAS-cloud-builds zet je ze als project-secrets (nooit committen):

```sh
eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value "https://<ref>.supabase.co" --visibility plaintext --environment production --environment preview --environment development
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>"                --visibility sensitive  --environment production --environment preview --environment development
```

> `SUPABASE_SERVICE_ROLE_KEY` hoort **niet** in een client-build — die is alleen voor de
> RLS-integratietests (lokaal/CI).

## Sentry — crash-/foutmonitoring (INF-4)

Het Sentry-project (`evdn/huishoek`, EU-region `de.sentry.io`) en de app-bedrading staan
klaar: `@sentry/react-native` als config-plugin (org/project/url in `app.config.js`),
`metro.config.js` via `getSentryExpoConfig` (genereert source maps), en `lib/monitoring.js`
dat Sentry alleen init zodra er een DSN is. Twee env-variabelen sturen het:

| Variabele | Soort | Waar | Doel |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | **publiek** (in de bundle) | `.env` + EAS-env | runtime-init; leeg = monitoring uit (no-op) |
| `SENTRY_AUTH_TOKEN` | **secret**, build-time | EAS-env (sensitive) | source-map-upload tijdens de native build |

```sh
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "<DSN>"        --visibility plaintext --environment production --environment preview --environment development
eas env:create --name SENTRY_AUTH_TOKEN      --value "<auth-token>" --visibility sensitive --environment production --environment preview
```

De DSN staat in Sentry onder *Project Settings → Client Keys (DSN)*; de auth-token maak je
onder *Settings → Auth Tokens* (org-token met `project:releases`). Ontbreekt de token, dan
draait de build gewoon door — alleen de source-map-upload wordt overgeslagen (stack traces
blijven dan ongesymboliceerd). Zet de token **nooit** in `app.config.js`/git.

## Preview build — snelste test op je telefoon (geen dev-server)

Het `preview`-profiel bouwt een **zelfstandige APK met de JS al ingebundeld**. Je hoeft
dus géén Metro/dev-server te draaien en niets bereikbaar te houden — handig wanneer je
toestel niet op hetzelfde netwerk zit als de dev-machine (bv. cloud-/remote-omgevingen,
waar de LAN- en tunnel-route geblokkeerd zijn).

```sh
eas build -p android --profile preview         # bouwt een APK in de cloud
# → open de build-link op je Android-telefoon en installeer de APK (sideload)
```

Vereist alleen dat de Supabase-env als EAS-env staat (zie *Secrets* hierboven). De app
draait dan tegen je live Supabase; nieuwe code vereist een nieuwe build (geen OTA, want
`expo-updates` is niet geïnstalleerd).

## Development build op een echt toestel (fase B)

```sh
eas build -p android --profile development     # bouwt een APK in de cloud
# → download de APK, installeer op het toestel (sideload — toegestaan in NL, zie plan 08 B5)
npx expo start --dev-client --lan              # LAN, geen tunnel → omzeilt de ngrok-blokkade
```

## Release naar Play Internal (fase E)

```sh
eas build  -p android --profile production     # AAB; versionCode wordt auto-increment
eas submit -p android --latest                 # naar de 'internal' track (zie eas.json submit)
```

Vereist vooraf in Play Console: app `app.huishoek` aangemaakt, een service-account-key
gekoppeld (`eas credentials`), en identiteitsverificatie afgerond. De "12-testers/14-dagen"-
regel geldt pas bij de stap naar publieke productie, niet voor Internal Testing.
