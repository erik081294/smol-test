# Plan 08 — Naar een professionele app: hardening & afmaken

> **Doel van deze ronde.** De app is feature-rijk en werkt op web, maar is nog een
> prototype: alleen-web, geen toestel-build, geen crash-monitoring, geen release-pijplijn,
> en een handvol Fase 1.5-eindjes staat op "te valideren" (🔧). Deze ronde maakt de
> *bestaande* app **betrouwbaar en installeerbaar** — géén nieuwe productfeatures.
>
> **Gekozen richting (2026-06-19):** eerst hardening & afmaken; **Android eerst**
> (Play Internal Testing). Fase 2-features (plannen 02–05, kernen al gemerged) komen
> ná deze ronde.
>
> Volgorde A → E. Elke fase is los afrondbaar en eindigt met acceptatiecriteria.
> Conventies: zie [`00-overzicht.md`](./00-overzicht.md) §"Gedeelde conventies".
>
> **Versie-check (online geverifieerd 2026-06-19).** Stack is actueel: **Expo SDK 56**
> (nieuwste stable, mei 2026; levert **RN 0.85** + **React 19.2** — exact onze
> `package.json`). Tooling-keuzes kloppen: `@sentry/react-native` (níét het deprecated
> `sentry-expo`; SDK 56-compat opgelost), **Maestro** voor E2E (2026-advies voor kritieke
> flows), EAS dev build (`developmentClient`+`distribution:internal`+APK). Niets verouderd.

---

## Fase A — De 🔧-eindjes dichttimmeren (Fase 1.5 echt af)

Goedkoopste waarde: schuld wegwerken die al "bijna af" is. Geen migratie.

**A1 · STR-9 undo uitrollen** — undo-toast (`lib/toast.js`) zit al op Boodschappen +
losse item-deletes; rol hem uit naar **taak-, uitgave- en plant-delete** zodat élke
destructieve actie terugdraaibaar is. Patroon: item lokaal verbergen → echte
`remove()` pas bij verlopen toast → "Ongedaan maken" herstelt zonder re-insert.

**A2 · STR-7 optimistic UI valideren** — `useCollection` doet al optimistische
`update`/`remove` met rollback; `completeTask`/`uncompleteTask` vinken direct af.
Nu écht testen: web + (na fase B) op toestel. Bevestig rollback bij een server-fout
(forceer een RLS-deny). Daarna STR-7 → ✅.

**A3 · STR-10 illustraties nalopen** — laatste 6 scènes in `lib/illustrations.js`
visueel nalopen (kar/munten/kalender/bezem/figuurtjes/plant) tegen de goedgekeurde
stijl (mok/klembord). Dark-mode + reduce-motion checken.

**A4 · 2-account-rooktest** — `VERIFICATIE.md` Stap 3 handmatig draaien (twee accounts,
twee huishoudens, deel-zichtbaarheid + realtime live). Dit is de laatste open INF-1-stap.

**Checklist:** `lib/useTasks.js`/`useExpenses.js`/`usePlants.js` (of de detail-schermen)
voor undo · backlog §6 statussen STR-7/STR-9/STR-10 → ✅, INF-1-notitie bijwerken.
**Acceptatie:** geen 🔧 meer op STR-items; elke delete heeft undo; rooktest afgetekend.

---

## Fase B — Op een echt Android-toestel (INF-7 + dev build)

Expo Go is geblokkeerd (firewall block-all + Defender-quarantaine van ngrok — zie
projectgeheugen). Oplossing: **niet via Expo Go, maar een EAS development build** (een
echte APK die je zelf installeert) + lokale LAN-dev i.p.v. tunnel.

**B1 · EAS-account & CLI** — `npx eas-cli login` (Expo-account). `eas init` koppelt het
project (`extra.eas.projectId` in `app.config.js`).

**B2 · `eas.json` met build-profielen:**
```jsonc
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal",
      "android": { "buildType": "apk" } },
    "preview":     { "distribution": "internal",
      "android": { "buildType": "apk" } },
    "production":  { "android": { "buildType": "app-bundle" } }
  },
  "submit": { "production": {} }
}
```

**B3 · `expo-dev-client`** toevoegen (`npx expo install expo-dev-client`) zodat de
development build een eigen launcher heeft (geen Expo Go nodig).

**B4 · Secrets in de cloud-build** — de Supabase-keys staan nu in `.env` (lokaal). Voor
EAS: `eas env:create` / `eas secret` voor `EXPO_PUBLIC_SUPABASE_URL` +
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (build-tijd, want `app.config.js` leest ze via
`process.env`). **Nooit committen.**

**B5 · Eerste build + install** — `eas build -p android --profile development` →
download APK → installeer op toestel → `npx expo start --dev-client --lan` (LAN, geen
tunnel = geen ngrok = niet geblokkeerd).

> **Sideloading veilig (geverifieerd 2026-06-19).** Google's nieuwe registratie-eis voor
> zijgeladen apps start 30-09-2026 alleen in BR/ID/SG/TH, wereldwijd pas 2027; ADB/dev-
> builds blijven toegestaan. Voor NL nu geen blokkade voor deze fase.

**B6 · Rooktest op toestel** — realtime, plant-foto's (Storage), haptics, secure-store
(sessie), i18n-apparaatdetectie (`lib/i18nRuntime.js`), donker/licht. Noteer wat op web
"werkte" maar op toestel breekt.

**Checklist:** `eas.json` (nieuw) · `app.config.js` (`extra.eas.projectId`) ·
`package.json` (`expo-dev-client`) · `VERIFICATIE.md` (toestel-sectie) · backlog INF-7 → ✅.
**Acceptatie:** app draait als losse APK op een echt Android-toestel met live data; LAN-dev
werkt zonder tunnel.

---

## Fase C — Crash- & foutmonitoring (INF-4)

Een professionele app weet wanneer hij crasht in productie.

**C1 · Sentry** — `npx expo install @sentry/react-native`; config-plugin in
`app.config.js` `plugins`. DSN via env/secret (zelfde patroon als B4).

**C2 · Init + error boundary** — init in `app/_layout.js` (root); een React error
boundary die crashes opvangt → vriendelijke NL-fallback (uit `lib/ui.js`/`t()`) +
`Sentry.captureException`. Sluit aan op de bestaande `lib/toast.js` voor herstelbare
fouten.

**C3 · Source maps** — via het EAS-build-proces uploaden (Sentry-plugin doet dit bij
`eas build`) zodat stacktraces leesbaar zijn.

**C4 · Datahygiëne** — geen PII naar Sentry (geen e-mail/namen in breadcrumbs); `db.js`-
fouten loggen mét context-label maar zónder rij-inhoud.

**Checklist:** `app.config.js` (plugin) · `app/_layout.js` (init + boundary) ·
nieuw `lib/errorBoundary.js` · backlog INF-4 → ✅.
**Acceptatie:** een geforceerde crash verschijnt in Sentry met leesbare stacktrace; de
gebruiker ziet een nette fallback i.p.v. een witte crash.

---

## Fase D — E2E-tests op de kritieke flows (INF-3)

Units dekken de pure logica; E2E dekt "doet de echte app het nog".

**D1 · Maestro** (lichter dan Detox voor Expo) — `.maestro/`-flows in YAML.
**D2 · Drie kritieke flows:** (1) onboarding → huishouden aanmaken → taak toevoegen →
afvinken; (2) uitgave toevoegen + splitsen → saldo klopt; (3) boodschap toevoegen →
afvinken → undo. Draai tegen de development build (fase B).
**D3 · CI** — eigen workflow (los van de snelle unit-`ci.yml`) die op een
Android-emulator de Maestro-flows draait (of voorlopig handmatig + gedocumenteerd in
`VERIFICATIE.md` als de emulator-CI te zwaar is).

**Checklist:** `.maestro/*.yaml` (nieuw) · evt. `.github/workflows/e2e.yml` ·
backlog INF-3 → ✅.
**Acceptatie:** de drie flows draaien groen tegen een echte build.

---

## Fase E — Release-pijplijn naar Play Internal (INF-5)

**E1 · Productie-build** — `eas build -p android --profile production` (AAB).
**E2 · Play Console** — developer-account ($25 eenmalig), app `app.huishoek` aanmaken,
**Internal Testing**-track (tot 100 testers, direct beschikbaar). `eas submit -p android`
(service-account-key) of eerste keer handmatig uploaden.

> **Plan vooruit (geverifieerd 2026-06-19):** (1) een nieuw persoonlijk account vereist
> **identiteitsverificatie** (2FA + overheids-ID, uren–2 dagen) — regel dit vóór E. (2) De
> **"12-testers / 14-dagen"-regel** geldt voor de stap naar *publieke productie*, **niet**
> voor Internal Testing — dus deze fase (Play Internal) kan gewoon door; calculeer 2–4 weken
> extra in zodra je naar productie wilt.
**E3 · Versioning** — `version` in `app.config.js` + `autoIncrement` voor
`versionCode` in `eas.json` (production-profiel).
**E4 · Geautomatiseerd (optioneel)** — GitHub Action die op een git-tag (`v*`)
`eas build --profile production --non-interactive` + `eas submit` draait
(EAS-token als repo-secret).
**E5 · Store-hygiëne** — privacybeleid-URL, datasafety-formulier (we verzamelen account
+ huishoud-data), korte storevermelding. Sluit aan op de RLS-belofte uit de README.

**Checklist:** `eas.json` (submit-config + autoIncrement) · evt. `.github/workflows/release.yml`
· `VERIFICATIE.md` (release-checklist) · backlog INF-5 → ✅.
**Acceptatie:** een tester installeert Huishoek via Play Internal Testing en logt in op
live data.

---

## Daarna (buiten deze ronde)

Met een betrouwbare, installeerbare, gemonitorde Android-app als basis: de **Fase 2-
features** bovenop de al-gemergede kernen — plan [02 boodschappen-intelligentie](./02-boodschappen-intelligentie.md)
(`productMatch`/`priceTrack`), [03 grote aankopen](./03-grote-aankopen.md) (`decisions`),
[04 kosten/autodelen](./04-kosten-autodelen.md) (`reservations`/`recurringExpense`),
[05 notificaties](./05-notificaties.md) (`notifications` + `expo-notifications`). Elke
kern wacht op zijn migratie + hook + scherm. **iOS/TestFlight** als tweede platform zodra
de Android-pijplijn staat.

## Aanbevolen volgorde

**A → B → C** is de kern (afmaken, op toestel, weten wanneer het breekt). **D** en **E**
kunnen deels parallel zodra B staat. Begin met **A** (geen externe accounts nodig) terwijl
je het Expo/Play-account regelt voor B/E.
