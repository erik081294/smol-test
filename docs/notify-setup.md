# Notificaties — setup (PLT-1)

## Trap 1 — Lokale herinneringen (werkt out-of-the-box op een dev/echte build)
- Deps: `expo-notifications`, `expo-device` (staan in `package.json`).
- De hook `lib/useNotifications.js` wordt in `app/_layout.js` gemount zodra je bent
  ingelogd met een huishouden. Hij vraagt permissie, en (her)plant lokale meldingen
  voor taken, plantzorg, maaltijden en voorraad via de pure `lib/notifications.allReminders`.
- Voorkeuren: scherm **Huishouden → Herinneringen** (`app/instellingen.js`), lokaal
  opgeslagen (`lib/notificationPrefs.js`). Web = stil no-op.
- Werkt **niet** in Expo Go (SDK 53+): gebruik een **dev build** (zie `docs/eas-setup.md`).

## Trap 2 — Remote push (optioneel)
1. Migratie `0018_push_tokens.sql` pushen (`supabase db push`).
2. Edge Function deployen: `supabase functions deploy notify`.
3. Database Webhook: Dashboard → Database → Webhooks → tabel `tasks`, events
   **insert + update**, type **Supabase Edge Functions** → functie `notify`.
   (`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` worden automatisch geïnjecteerd.)
4. De client registreert het Expo-push-token automatisch in `push_tokens` zodra
   permissie is verleend (vereist een EAS `projectId` in de app-config).

Effect: krijgt iemand een taak toegewezen (`assigned_to` ≠ maker), dan stuurt de
functie die persoon een push via de Expo Push API. Uit te breiden naar uitgave-
toewijzing en reservering-botsingen.

**Dedup & robuustheid:** de functie stuurt alléén bij een echte toewijzing
(`assigned_to` gezet én bij UPDATE gewijzigd t.o.v. `old_record`), dus geen dubbele
push bij ongerelateerde taak-edits. Tokens staan uniek op `(profile_id, token)`
(`push_tokens` PK), dus per apparaat hooguit één rij. Token-registratie is automatisch
(`lib/useNotifications.js`, best-effort upsert na permissie) — geen aparte API nodig.
