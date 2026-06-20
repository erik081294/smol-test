# Plan 05 — Notificaties & herinneringen (PLT-1)

**Backlog:** PLT-1. **Soort:** cross-cutting platform (raakt elke module licht). **Migratie:**
alleen voor trap 2 (remote push). **Afhankelijkheden:** geen; sluit aan op de keuken-loop
(plan 09) voor maaltijd-/voorraad-herinneringen. Nieuwe deps: `expo-notifications`, `expo-device`.

> Bouwt op de bestaande pure kern `lib/notifications.js` (al aanwezig: `plannedReminders`,
> `dailySummary`, `reminderId`). Twee trappen, **beide volledig uitgewerkt** (geen afslag):
> trap 1 lokaal (MVP), trap 2 remote push. Web = stil no-op (zoals `lib/haptics.js`).

## B1. Dependencies & config
- `npx expo install expo-notifications expo-device`. Plugin-blok in `app.config.js`
  (notificatie-icoon/kleur). Mount `useNotifications()` in `app/_layout.js` ná de Auth/
  Household/Toast-providers. Alles guarden met `Platform.OS !== 'web'`.

## B2. Pure kern uitbreiden — `lib/notifications.js`
Toevoegen in dezelfde stijl (puur, stabiele ids, getest):
```js
export function mealReminders(entries, { now, time = '16:30' }) { /* per geplande maaltijd -> [{id,fireAt,title,body}] */ }
export function pantryAlerts(pantryItems, { now, soonDays = 2 }) { /* verlopen/binnenkort/bijna-op, gebucket */ }
export function allReminders({ tasks, meals, pantry }, prefs, now) { /* combineert + filtert per-domein */ }
```
Units (`tests/notifications.test.js` uitbreiden): `mealReminders` alleen toekomstige dagen +
stabiele id per (datum,recept); `pantryAlerts` bucketgrenzen + geen alert zonder houdbaarheid/
drempel; `allReminders` respecteert per-domein prefs.

## B3. Impure hook — `lib/useNotifications.js`
- Eenmalig permissie (`Notifications.requestPermissionsAsync`) + Android-kanaal.
- **Sync** bij wijziging van `tasks`/`meal_plan_entries`/`pantry_items` (en app-start): cancel
  eerder geplande huishoek-notificaties en herplan op `allReminders` (idempotent via stabiele
  ids). Plan ook de `dailySummary` op het ingestelde tijdstip. Cap op OS-limieten.
- Leest prefs (B4); doet niets als globaal uit.

## B4. Voorkeuren + scherm
- **Opslag** lokaal via `@react-native-async-storage/async-storage` (zie `lib/supabase.js`-
  patroon). `lib/notificationPrefs.js` (get/set + defaults): `enabled`, `dailySummaryTime`,
  `leadMinutes`, `mealReminderTime`, per-domein toggles (`taken`, `plantzorg`, `maaltijden`, `voorraad`).
- **Scherm** `app/instellingen.js` (via een rij op `huishouden.js`): toggles (`Chip`/switch),
  tijdkiezers (quick-times + `Stepper`), uitleg-`Banner`. Permissie geweigerd → `Banner` met
  knop naar systeeminstellingen (`Linking`).

## B5. Trap 2 — Remote push (volledig)
- **Migratie** `NNNN_push_tokens.sql`:
  ```sql
  create table if not exists public.push_tokens (
    profile_id uuid not null references public.profiles(id) on delete cascade,
    token text not null, platform text, updated_at timestamptz not null default now(),
    primary key (profile_id, token));
  alter table public.push_tokens enable row level security;
  create policy push_tokens_self on public.push_tokens for all
    using (profile_id = auth.uid()) with check (profile_id = auth.uid());
  ```
- **Tokenregistratie**: in `useNotifications` bij login `getExpoPushTokenAsync()` → upsert.
- **Edge Function** `supabase/functions/notify/index.ts` (patroon van de bestaande
  `scan-receipt`-functie): getriggerd door een Database Webhook op `tasks` (assigned_to
  wijzigt en ≠ created_by); zoekt met de service-role de tokens van de toegewezene en POST
  naar de Expo Push API (`https://exp.host/--/api/v2/push/send`). Idempotent op (task_id,
  assigned_to). Deploy + webhook documenteren in `docs/notify-setup.md`.
- Later uitbreidbaar naar uitgave-toewijzing en reservering-botsingen.

## B6. Edge cases, tests, acceptatie
- Web/geen hardware: no-op; prefs "alleen op mobiel". Doorrollende taken: stabiele
  `reminderId` (incl. `due_date`) vervangt de oude occurrence. Tijdzone: lokale toesteltijd.
- **Acceptatie**: taak/maaltijd met tijd → lokale notificatie op tijd; dagsamenvatting klopt;
  voorraad-alert bij naderende houdbaarheid; prefs uit/aan werkt; remote push komt aan bij
  toewijzing. `npm test` groen incl. uitgebreide `notifications`-units.

## B7. File-checklist
**Nieuw:** `lib/useNotifications.js` · `lib/notificationPrefs.js` · `app/instellingen.js` ·
`supabase/migrations/NNNN_push_tokens.sql` · `supabase/functions/notify/index.ts` ·
`docs/notify-setup.md`. **Gewijzigd:** `lib/notifications.js` · `tests/notifications.test.js`
· `app/_layout.js` · `app.config.js` · `package.json` · `app/(tabs)/huishouden.js` ·
`lib/i18n.js` (`notif.*`) · `huishoek-backlog.md` (PLT-1) · `docs/plans/00-overzicht.md`.
