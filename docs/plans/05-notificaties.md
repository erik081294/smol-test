# Plan 05 — Notificaties & herinneringen

**Backlog:** PLT-1. **Soort:** cross-cutting platform (raakt elke module licht).
**Migratie:** optioneel (alleen voor remote push / prefs in de cloud).
**Afhankelijkheden:** geen. Nieuwe dependency: `expo-notifications` (+ `expo-device`).

## Waarom & aanpak

Herinneringen zijn hoge-waarde, lage-frictie: "3 taken vandaag", "Monstera water geven".
**Aanpak in twee trappen**, begin bij trap 1:

1. **Lokale, geplande notificaties** — geen server nodig. De app plant op het toestel
   notificaties voor taken met een datum/tijd en een dagelijkse samenvatting. Werkt offline,
   privacyvriendelijk, en dekt 90% van de waarde.
2. **Remote push** (optioneel, later) — Expo push tokens + een Supabase Edge/cron-functie
   die pushes stuurt (bijv. wanneer iemand jóu een taak toewijst). Vereist de migratie
   hieronder. Noteer als upgrade-pad.

Belangrijk: houd de **beslislogica puur en testbaar**; alleen het plannen/cancelen en de
permissie-aanvraag zijn impure (platform-API).

## Trap 1 — Lokale notificaties

### Dependency & config
- `npx expo install expo-notifications expo-device`.
- In `app.config.js`/`app.json`: het `expo-notifications`-plugin-blok (icoon/kleur).
- iOS/Android vragen runtime-permissie; **web** ondersteunt dit anders → guard met
  `Platform.OS !== 'web'` (of de Web Notifications-API als je het later wilt).

### Pure logica — `lib/notifications.js` (de testbare kern)
```js
import { parseISO } from 'date-fns';
// Welke taken verdienen een herinnering, en wanneer/waarmee?
//   tasks: open taken met due_date (+ optioneel due_time)
//   opts:  { now, leadMinutes } (bijv. 0 = op tijd, of X min ervoor)
// -> [{ taskId, fireAt: Date, title, body }]  (alleen toekomstige fireAt)
export function plannedReminders(tasks, { now = new Date(), leadMinutes = 0 } = {}) { /* … */ }

// Tekst van de dagelijkse samenvatting voor een dag.
export function dailySummary(tasks, day = new Date()) { /* -> { title, body } | null (null = niets te melden) */ }

// Stabiele notificatie-id per taak(occurrence), zodat herplannen oude vervangt.
export function reminderId(task) { /* -> `task:${task.id}:${task.due_date}` */ }
```

### Impure laag — `lib/useNotifications.js` (hook)
- Vraagt eenmalig permissie (`Notifications.requestPermissionsAsync`) en zet een
  Android-kanaal.
- **Sync-strategie**: bij wijziging van `tasks` (uit `useTasks`) en bij app-start: cancel
  alle eerder geplande huishoek-notificaties en herplan op basis van `plannedReminders`
  (idempotent dankzij stabiele `reminderId`). Plan ook de `dailySummary` (dagelijkse trigger
  op een vast tijdstip uit de prefs).
- Respecteer de prefs (zie onder). Cap het aantal geplande notificaties (OS-limieten).

### Voorkeuren (prefs)
- **Eenvoud eerst (geen migratie):** bewaar prefs lokaal met het bestaande opslagpatroon
  (`@react-native-async-storage/async-storage`, al in deps; zie `lib/supabase.js` voor de
  platform-aware opslag). Velden: `enabled`, `dailySummaryTime` (bijv. "08:00"),
  `leadMinutes`, per-module aan/uit.
- **Scherm**: een sectie op `app/(tabs)/huishouden.js` of een nieuw `app/instellingen.js`
  met toggles (`Chip`/switch) + een tijdkiezer (hergebruik de `Stepper`/quick-times).

### Units — `tests/notifications.test.js`
- `plannedReminders` neemt alleen toekomstige, open, gedateerde taken; `leadMinutes`
  verschuift `fireAt`; afgevinkte/datumloze taken vallen weg; `reminderId` stabiel per
  occurrence (verandert mee met `due_date` bij doorrollen → oude wordt vervangen).
- `dailySummary` geeft null bij 0 taken, anders een telling-tekst; respecteert "vandaag".

### Integratie
- Mount `useNotifications()` in `app/_layout.js` (na auth/household, zodat er taken zijn).
- Plantenverzorging valt hier automatisch onder: verzorgingstaken zijn gewone `tasks` met
  `plant_id`, dus ze krijgen dezelfde herinneringen. Optioneel een mooiere body via de
  plantnaam.

## Trap 2 — Remote push (optioneel, upgrade-pad)

### Migratie `NNNN_push_tokens.sql`
```sql
create table if not exists public.push_tokens (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text,
  updated_at  timestamptz not null default now(),
  primary key (profile_id, token)
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_self on public.push_tokens;
create policy push_tokens_self on public.push_tokens for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
```
> Mede-leden moeten elkaars token kunnen lezen om een push te triggeren — doe dat **niet**
> via RLS-verbreding maar via een `security definer` functie / Edge Function die met de
> service-role de tokens van de betrokkenen opzoekt en de Expo Push API aanroept.

### Verzendkant
- Een Supabase **Edge Function** (of externe worker) die op events reageert (bijv. een
  `tasks`-insert met `assigned_to <> created_by`) en via de **Expo Push API** een bericht
  stuurt naar de tokens van de toegewezene. Trigger via Database Webhooks of `pg_cron`.
- Client registreert het token (`Notifications.getExpoPushTokenAsync`) bij login en schrijft
  het naar `push_tokens` (upsert).

## Edge cases & beslissingen
- **Web**: geen `expo-notifications`; toon de prefs als "alleen op mobiel" of gebruik de
  Web Notifications-API in een aparte tak. Niet blokkerend voor trap 1 op mobiel.
- **Permissie geweigerd**: faal stil, toon een nette banner met uitleg + knop naar de
  systeeminstellingen.
- **Doorrollende taken**: dankzij `reminderId` (incl. `due_date`) wordt bij elk doorrollen
  netjes de oude notificatie vervangen door de nieuwe occurrence.
- **Tijdzone**: plan op lokale tijd van het toestel; `due_time` is een wandkloktijd.

## Acceptatiecriteria
- Een taak met datum/tijd voor straks → er valt op tijd een lokale notificatie (mobiel).
- De dagelijkse samenvatting verschijnt op het ingestelde tijdstip en klopt qua telling.
- Prefs uit/aan werkt; permissie-weigering crasht niets.
- `npm test` groen incl. `notifications`.

## File-checklist
**Nieuw:** `lib/notifications.js` · `lib/useNotifications.js` · `tests/notifications.test.js`
· (optioneel) `app/instellingen.js` · (trap 2) `supabase/migrations/NNNN_push_tokens.sql`
+ een Edge Function.
**Gewijzigd:** `app/_layout.js` (hook mounten) · `app.config.js` (plugin) · `package.json`
(deps) · `app/(tabs)/huishouden.js` (prefs-sectie, of het nieuwe instellingen-scherm) ·
`lib/icons.js` (`bell` bestaat al) · `huishoek-backlog.md` (PLT-1 status).
