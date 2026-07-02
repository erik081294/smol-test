# Notificaties — setup (PLT-1)

## Trap 1 — Lokale herinneringen (werkt out-of-the-box op een dev/echte build)
- Deps: `expo-notifications`, `expo-device` (staan in `package.json`).
- De hook `lib/useNotifications.js` wordt in `app/_layout.js` gemount zodra je bent
  ingelogd met een huishouden. Hij vraagt permissie, en (her)plant lokale meldingen
  voor taken, plantzorg, maaltijden en voorraad via de pure `lib/notifications.allReminders`.
- Voorkeuren: scherm **Huishouden → Herinneringen** (`app/instellingen.js`), lokaal
  opgeslagen (`lib/notificationPrefs.js`). Web = stil no-op.
- Werkt **niet** in Expo Go (SDK 53+): gebruik een **dev build** (zie `docs/eas-setup.md`).

## Trap 2 — Remote push

### Architectuur (wat er al staat)
- **Functie** `supabase/functions/notify/` is opgesplitst in een pure kern
  (`core.js` — bepaalt wélke push naar wie, unit-getest in `tests/notify.test.js`) en een
  impure schil (`index.ts` — secret-check, idempotentie, tokens ophalen, versturen, opruimen).
  Nieuwe triggers toevoegen = een handler in `core.js` schrijven en in `HANDLERS` registreren.
- **Token-registratie** is automatisch: `lib/useNotifications.js` upsert het Expo-push-token
  in `push_tokens` zodra permissie is verleend (vereist de EAS `projectId`, staat in `app.config.js`).
- **Idempotentie + audit**: elke verstuurde push claimt een rij in `push_deliveries`
  (migratie `0023`), zodat een herhaalde webhook-fire geen dubbele melding geeft.

### Flip-on (eenmalig, vereist Supabase-toegang — connector/CLI/dashboard)
1. **Migraties live?** `push_tokens` (0018) én `push_deliveries` (0023) staan **al live**
   (geverifieerd 2026-06-30 via MCP `list_migrations`; DB op `0066`). Niets te doen.
   > **Let op:** `supabase db push` is in dit project **kapot** (history diverged) — gebruik
   > nooit `db push`; nieuwe migraties gaan via MCP `apply_migration` (zie `VERIFICATIE.md`).
2. **Webhook-secret zetten** (gedeeld geheim tussen de webhook en de functie —
   **verplicht**: de functie weigert te draaien (`500`) zonder dit secret, want met
   `verify_jwt=false` is dit de enige authenticatie):
   ```
   supabase secrets set NOTIFY_WEBHOOK_SECRET=<lang-willekeurig-geheim>
   ```
   (`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` worden automatisch geïnjecteerd; niet zelf zetten.)
3. **Functie deployen** (config zet al `verify_jwt = false`, zie `supabase/config.toml`):
   ```
   supabase functions deploy notify
   ```
4. **Database Webhook** aanmaken: Dashboard → Database → Webhooks → **Create**:
   - Tabel **`public.tasks`**, events **Insert** + **Update**.
   - Type **Supabase Edge Functions** → functie **`notify`**.
   - HTTP-header toevoegen: **`x-notify-secret`** = exact dezelfde waarde als bij stap 2.

### FCM-credentials — Android-push (ingericht 2026-07-02)

Android-push loopt via **Firebase Cloud Messaging (FCM V1)**. Zonder dit haalt het toestel géén
Expo-push-token op — logcat toont dan `FirebaseApp failed to initialize ... google-services was not
applied` en `push_tokens` blijft leeg. Twee artefacten uit **één** Firebase-project (hier
`huishoek-62492`) zijn nodig; die aanmaken vereist een Google-login (browser). **Dit is gedaan:**

1. **Firebase-project** `huishoek-62492` met een **Android-app op package `app.huishoek`**.
2. **`google-services.json`** (bevat de FCM-sender) — geleverd aan de EAS-build als **secret
   file-env `GOOGLE_SERVICES_JSON`** (blijft uit git), niet gecommit:
   ```bash
   eas env:create development --name GOOGLE_SERVICES_JSON --type file \
     --value ./google-services.json --visibility secret --scope project
   ```
   [`app.config.js`](../app.config.js) zet `android.googleServicesFile` op `process.env.GOOGLE_SERVICES_JSON`
   (op de build) met een lokale terugval op `./google-services.json`. Het dev-profiel in
   [`eas.json`](../eas.json) staat op `environment: development` zodat die env-var laadt.
   > EAS logt lokaal *"…googleServicesFile… won't be uploaded"* — **onschuldig**: dat is de
   > terugval-evaluatie op je eigen machine; de builder materialiseert de file-env wél. Geverifieerd
   > in de APK (`google_app_id`/`gcm_defaultSenderId` van `huishoek-62492` zaten erin).
3. **FCM V1 service-account-sleutel** (Firebase → ⚙️ *Project settings* → *Service accounts* →
   *Generate new private key*) — **geüpload naar EAS en gekoppeld** aan `app.huishoek` als FCM V1
   (`googleServiceAccountKeyForFcmV1`, `isLegacy: false`). De sleutel is geheim en blijft buiten de
   repo. (Via de Expo-API gedaan; kan ook interactief met `eas credentials --platform android`.)

**Dev-build met FCM** (levert een installeerbare APK):
```bash
eas build --profile development --platform android
```
Na installatie van die build + notificatie-permissie registreert het token vanzelf in `push_tokens`.
> Zet je later het preview-profiel op push, herhaal dan stap 1–3 voor package **`app.huishoek.preview`**
> (eigen Android-app in Firebase + eigen FCM V1-koppeling).

### Toesteltest (2 accounts, dev build)
1. Twee accounts (A en B) in **hetzelfde huishouden**, elk op een **dev build** met
   notificatie-permissie verleend (zo staat per toestel een rij in `push_tokens`).
2. Account A maakt een taak en wijst die toe aan **B** (`assigned_to` = B).
3. **Verwacht:** B krijgt een push *"Nieuwe taak voor jou"* met de taaktitel.
4. **Idempotentie:** sla dezelfde taak nog eens op zonder de toewijzing te wijzigen → **geen**
   tweede push (de UPDATE-guard + `push_deliveries` vangen dit af).
5. **Pruning:** verwijder de app / trek de notificatie-permissie in op B's toestel en wijs een
   nieuwe taak toe → Expo meldt `DeviceNotRegistered` en de functie verwijdert dat token uit
   `push_tokens`.

### Effect & dedup
Krijgt iemand een taak toegewezen (`assigned_to` ≠ maker, en bij UPDATE daadwerkelijk
gewijzigd), dan stuurt de functie die persoon een push via de Expo Push API. Tokens staan
uniek op `(profile_id, token)` (`push_tokens` PK); dode tokens worden automatisch opgeruimd.

### Troubleshooting
- **Functie geeft 500 "NOTIFY_WEBHOOK_SECRET ontbreekt"** → het secret is niet gezet
  (stap 2). De functie is bewust fail-closed: zonder secret draait hij niet.
- **Webhook krijgt 401** → header `x-notify-secret` ontbreekt of komt niet overeen met
  `NOTIFY_WEBHOOK_SECRET`. (Krijg je in plaats daarvan een JWT-fout, dan staat `verify_jwt`
  nog op `true` — controleer `supabase/config.toml` en herdeploy.)
- **`skipped: "geen tokens"`** → de ontvanger heeft geen rij in `push_tokens`: permissie niet
  verleend, geen dev build, geen EAS `projectId`, of **FCM niet geconfigureerd** (zie de
  FCM-sectie hierboven — dit is de meest voorkomende oorzaak; check logcat op `FirebaseApp failed
  to initialize`).
- **Niets gebeurt** → check de functie-logs (`supabase functions logs notify`) en of de webhook
  daadwerkelijk vuurt (Dashboard → Database → Webhooks → recent deliveries).

### Uitbreiden (volgende rondes)
- **Uitgave-toewijzing** (Kosten): uitgaven hebben geen enkele toegewezene maar `expense_shares`
  → een handler die elke share-deelnemer (≠ maker) een push geeft, plus een webhook op `expenses`.
- **Maaltijd-/voorraadmeldingen** ("diner vanavond" / "bijna over datum"): via `pg_cron` dat de
  functie of een variant aanroept. Beide passen op de bestaande `HANDLERS`-registry in `core.js`.
