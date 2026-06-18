# Plan 06 — Platform-hardening (i18n, E2E, monitoring, release)

**Backlog:** INF-6 (i18n-fundament), INF-3 (E2E-tests), INF-4 (foutrapportage/monitoring),
INF-5 (release-pijplijn). **Soort:** infra/kwaliteit. **Migratie:** nee.
**Afhankelijkheden:** geen. Onafhankelijk te bouwen; **INF-6 het liefst vroeg** (raakt alle
strings).

Deze vier maken de app productie-waardig. Ze zijn los oppakbaar; hieronder elk als een
zelfstandig mini-plan.

---

## INF-6 — i18n-fundament

### Waarom
De UI-strings zijn nu NL-hardcoded. Een dunne i18n-laag nu maakt latere talen goedkoop —
en centraliseert tekst (handig voor consistentie en tone-of-voice).

### Aanpak (lichtgewicht, in-house — geen zware dep)
- `lib/i18n.js`: een `t(key, vars?)`-functie boven een dictionary. Begin met alleen `nl`.
  ```js
  const DICT = { nl: { 'task.add': 'Taak toevoegen', 'common.cancel': 'Annuleer', /* … */ } };
  let lang = 'nl';
  export function setLang(l) { lang = l; }
  export function t(key, vars) { /* lookup met fallback op key; vervang {naam}-placeholders */ }
  ```
- **Locale-detectie** later via `expo-localization` (`getLocales()[0].languageCode`),
  default `nl`. Datum/tijd loopt al via `date-fns/locale` (`nl`) — houd die koppeling.
- **Pluralisatie**: begin simpel (`t('tasks.count', {n})` met een `{n}`-placeholder); til
  pas op naar ICU/`intl` als een tweede taal echt komt.

### Uitrol (gefaseerd, niet big-bang)
1. Zet de laag neer + verhuis de strings van **één** scherm als referentie (bijv.
   `app/(tabs)/taken.js`).
2. **Regel:** nieuwe code gebruikt `t(...)`. Bestaande schermen migreer je incrementeel.
3. Een sleutelconventie: `domein.subdomein.naam` (`task.add`, `expense.split.equal`).

### Units — `tests/i18n.test.js`
- `t` vindt bestaande sleutels; valt terug op de sleutel bij ontbreken; vult `{vars}` in;
  `setLang` schakelt (met een test-dictionary).

### Files
**Nieuw:** `lib/i18n.js` · `tests/i18n.test.js`. **Gewijzigd:** schermen (incrementeel),
`package.json` (`expo-localization` wanneer je locale-detectie toevoegt).

---

## INF-3 — E2E-tests (kritieke flows)

### Keuze: Maestro (aanbevolen)
Lichter dan Detox, YAML-flows, werkt goed met Expo dev/preview builds en in CI. Detox is
krachtiger maar zwaarder op te zetten — overkill voor nu.

### Op te nemen flows (`/.maestro/`)
- `onboarding.yaml` — registreren → huishouden aanmaken → in de app belanden.
- `task_add_complete.yaml` — taak toevoegen → zien in lijst → afvinken → naar Afgerond.
- `expense_split.yaml` — uitgave toevoegen, gelijk splitsen → saldo klopt → "Vereffenen".
- `grocery_realtime.yaml` (optioneel) — boodschap toevoegen → afvinken → wissen.

Voorbeeld (`/.maestro/task_add_complete.yaml`):
```yaml
appId: nl.huishoek.app           # uit app.config.js (zet een vaste bundle/package id)
---
- launchApp
- tapOn: "Taak toevoegen"
- inputText: "E2E test taak"
- tapOn: "Taak toevoegen"
- assertVisible: "E2E test taak"
- tapOn: "E2E test taak"         # of het checkbox-label
- tapOn: "Afgerond"
- assertVisible: "E2E test taak"
```

### CI
- Een aparte workflow (`.github/workflows/e2e.yml`) die een **preview build** maakt (EAS,
  zie INF-5) of de app in een emulator start en `maestro test .maestro/` draait. E2E is
  trager/brozer dan units; draai 'm op PR-label of nightly, niet op elke push.

### Voorwaarde
Een **test-Supabase** met de migraties + "Confirm email" uit (zie README §1.5) zodat de
onboarding-flow zonder mailbevestiging doorloopt. Gebruik een wegwerp-account per run.

### Files
**Nieuw:** `.maestro/*.yaml` · `.github/workflows/e2e.yml` · korte sectie in README.

---

## INF-4 — Foutrapportage / monitoring

### Keuze: Sentry (`@sentry/react-native`, Expo-plugin)
- `npx expo install @sentry/react-native`; plugin in `app.config.js`; `Sentry.init({ dsn })`
  in `app/_layout.js`. **DSN via env** (`EXPO_PUBLIC_SENTRY_DSN`) — niet hardcoden.
- **Koppel aan de bestaande foutlaag**: `lib/db.js` (`run`/`mutate`) is hét knooppunt waar
  Supabase-fouten langskomen. Voeg daar een `Sentry.captureException` toe (met de `context`
  als tag) náást de huidige NL-melding. Eén plek = consistente capture.
- Zet een `ErrorBoundary` rond de app-root voor render-crashes (Sentry levert er een).
- **Privacy**: stuur geen PII mee; scrub e-mail/namen. Sample rates laag in dev.

### Files
**Gewijzigd:** `app/_layout.js` (init + boundary) · `lib/db.js` (capture) ·
`app.config.js` (plugin) · `.env.example` (`EXPO_PUBLIC_SENTRY_DSN=`) · `package.json`.

---

## INF-5 — Release-pijplijn (EAS)

### Doel
Reproduceerbare builds naar TestFlight / Play Internal, los van lokale machines.

### Stappen
- `eas.json` met profielen: `development` (dev client), `preview` (intern/QA, ook voor
  Maestro), `production` (store).
- **App-identiteit** vastleggen: `ios.bundleIdentifier` + `android.package` in
  `app.config.js` (bijv. `nl.huishoek.app`) — nu nog niet gezet; nodig voor builds én voor
  de Maestro `appId`.
- **Secrets**: Supabase-URL/anon-key en Sentry-DSN als **EAS secrets** (`eas secret:create`)
  i.p.v. `.env` in de build.
- **CI** (`.github/workflows/release.yml`): op een version-tag → `eas build --profile
  production` + `eas submit`. Vereist `EXPO_TOKEN` als repo-secret.
- Versiebeheer: `runtimeVersion`-policy + bump van `version`/build-nummer per release.

### Files
**Nieuw:** `eas.json` · `.github/workflows/release.yml`. **Gewijzigd:** `app.config.js`
(bundle/package id, runtimeVersion) · `.env.example` (documenteer welke vars EAS-secrets zijn).

---

## Aanbevolen volgorde binnen dit plan
1. **INF-6 (i18n)** — eerst, want elke nieuwe string die je nu schrijft kan meteen via `t()`.
2. **INF-4 (Sentry)** — klein, hoge waarde, vangt fouten zodra echte gebruikers testen.
3. **INF-5 (EAS)** — nodig zodra je op echte toestellen/TestFlight wilt (ook randvoorwaarde
   voor zinvolle E2E in CI).
4. **INF-3 (Maestro)** — als de kernflows stabiel zijn; draai op label/nightly.

## Acceptatiecriteria
- `t('common.cancel')` rendert NL; een ontbrekende sleutel valt zichtbaar terug i.p.v. te
  crashen; `npm test` groen incl. `i18n`.
- Een geforceerde fout in een Supabase-call verschijnt in Sentry met de juiste context-tag.
- `eas build --profile preview` levert een installeerbare build; `maestro test .maestro/`
  draait de kernflows groen tegen die build.
