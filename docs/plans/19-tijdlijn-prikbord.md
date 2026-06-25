# Plan 19 — Tijdlijn / Prikbord (TML-1 t/m TML-8)

**Backlog:** TML-1 t/m TML-8. **Soort:** nieuwe module die de bestaande Activiteit-module
(PLT-6) opslokt en uitbouwt tot een **prikbord met tijdlijn** — handgeschreven berichten
(tekst + grote foto's) als hoofdmoot, met de automatische activiteit als samenvouwbare laag
eronder, plus emoji-reacties, tekstreacties en een instelbare filter. **Migratie:** ja
(`timeline_posts` + `timeline_photos` + `timeline_comments` + `timeline_reactions` + bucket,
plus twee filter-config-tabellen). **Afhankelijkheden:** PLT-6 (de bestaande activity-engine
`lib/activity.js` wordt hergebruikt en uitgebreid); FND-1 alléén voor de subgroep-filter (TML-8).

> Leest op de gedeelde conventies uit [`00-overzicht.md`](./00-overzicht.md) (migratie-idempotentie,
> `enable_module_rls`, het zichtbaarheidscontract, `useCollection`/`run`/`mutate`, `lib/ui.js`,
> de pure-kern-+-impure-schil-opzet). Die worden hier niet herhaald.

## Ontwerpkeuzes (vastgelegd met Erik, 2026-06-25)

1. **Berichten primair, events als laag.** De tijdlijn toont handgeschreven berichten groot;
   systeem-events (taak afgevinkt, uitgave toegevoegd, …) staan eronder als een **samenvouwbare /
   toggle-bare laag** ("toon ook activiteit"), niet kris-kras tussen de berichten.
2. **Reageren — twee niveaus.** Een **emoji-reactie kan op álles** (berichten én systeem-events,
   bv. 👏 onder "Tim vinkte de afwas af"). Een **geschreven reactie (comment) kan alléén op
   handgeschreven berichten** — systeem-events krijgen geen comment-thread.
3. **Filteren op vier assen:** per **module**, per **gebeurtenis-type**, per **persoon/lid** en per
   **zichtbaarheid/subgroep**. De subgroep-as leunt op FND-1 en is daarom een eigen, latere stap (TML-8).
4. **Twee lagen filter-config, net als module-toggling.** Het huishouden (owner) zet de **basis**
   — wat überhaupt op de tijdlijn mag — en elk lid **verfijnt** voor zichzelf wat hij ziet. Een
   huishouden-uitzetting wint van de gebruiker (zelfde regel als `effectiveModules` in `lib/modules.js`).

## Bouwvolgorde (één item per stap, elk los te mergen)

```
TML-1 fundament (posts + foto's, module-rename)  ──► de backbone, alles hangt hieraan
  ├─ TML-2 pinnen
  ├─ TML-3 emoji-reacties (posts + events)
  ├─ TML-4 tekstreacties/comments (alleen posts)
  └─ TML-5 systeem-events als samenvouwbare laag   ──► leunt ook op PLT-6
        └─ TML-6 filter (module + event-type, twee lagen)
              ├─ TML-7 filter per persoon/lid
              └─ TML-8 filter per zichtbaarheid/subgroep   ──► gate: FND-1
```

---

## TML-1 — Fundament: berichten posten (tekst + grote foto's)

### Waarom
Het hart van het prikbord: een lid plaatst een bericht met tekst en/of één of meer **grote
foto's**, zichtbaar voor het huishouden (of een subgroep, via het bestaande contract). Dit
vervangt het lees-only Activiteit-scherm; de event-feed komt er in TML-5 als laag onder terug.

### Datalaag (migratie — volgende vrije nummer, bv. `0046_tijdlijn.sql`)
**`timeline_posts`** — volgt het standaard zichtbaarheidscontract (creator-kolom `author_id`):
```sql
create table if not exists public.timeline_posts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  body          text,                                  -- nullable: foto-only mag
  pinned_at     timestamptz,                           -- TML-2 (null = niet gepind)
  pinned_by     uuid references public.profiles(id),
  visibility    text not null default 'household'
                  check (visibility in ('household','subgroup','custom')),
  share_subgroup_id uuid references public.subgroups(id) on delete set null,
  share_with    uuid[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.timeline_posts add constraint timeline_posts_visibility_consistent check (
  (visibility = 'subgroup' and share_subgroup_id is not null)
  or (visibility <> 'subgroup' and share_subgroup_id is null)
);
select public.enable_module_rls('timeline_posts', 'author_id');
create index if not exists timeline_posts_feed_idx
  on public.timeline_posts (household_id, pinned_at desc nulls last, created_at desc);
```
> **Body-of-foto-vereiste** (een leeg bericht mag niet) borgen we in de app-laag (compose
> valideert), niet in een cross-tabel-CHECK — dat is hier de pragmatische keuze, conform hoe
> `plant_photos` een notitie-of-foto in code afdwingt.

**`timeline_photos`** — kind-tabel (erft de zichtbaarheid van de post), meerdere foto's per bericht:
```sql
create table if not exists public.timeline_photos (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.timeline_posts(id) on delete cascade,
  photo_path  text not null,                           -- pad in Storage-bucket 'timeline'
  width       int,
  height      int,
  position    int not null default 0,                  -- volgorde in de galerij
  created_at  timestamptz not null default now()
);
create index if not exists timeline_photos_post_idx on public.timeline_photos (post_id, position);
```
RLS als `plant_photos` (0011): SELECT via `exists(... timeline_posts p where p.id = post_id and
public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id))`;
write via `public.is_member(p.household_id)`. Realtime via het do-block.

**Bucket `timeline`** — privé, RLS zoals `recipes` (0034) / `pets` (0038): pad-prefix
`<household_id>/…`, lezen/schrijven alleen voor leden van dat huishouden. Foto's gaan via de
bestaande `lib/photoPicker.js` (downscalet al naar 1280px, PERF-7) en `expo-image` met cache.

### Pure logica + units (`lib/timeline.js` + `tests/timeline.test.js`)
De pure kern die posts ordent en samenvat (géén React/Supabase):
- `orderTimeline(posts, now)` — **gepinde berichten eerst** (op `pinned_at` desc), daarna de rest
  op `created_at` desc. *Test de grens:* een gepinde oudere post staat bóven een nieuwere ongepinde;
  twee gepinde sorteren onderling op `pinned_at`. Assert de héle geordende lijst (volgorde-mutant).
- `summarizePost(post, { now })` → `{ id, when, hasPhotos, photoCount, … }` — relatieve tijd via de
  bestaande `relativeTime` uit `lib/activity.js` (hergebruiken, niet dupliceren).

> **DoD:** elke nieuwe `export function` krijgt in dezelfde PR een unit-test, en raak je `lib/activity.js`
> aan (TML-5), draai dan de mutatie-ratchet (`node scripts/mutation-check.mjs --since=origin/main`).

### Hook (`lib/useTimeline.js`)
Hergebruik `useCollection('timeline_posts', { order, creatorColumn:'author_id' })` voor de
posts, met een embedded select voor de foto's (`*, photos:timeline_photos ( id, photo_path,
width, height, position )`) en dubbele realtime-subscription (posts + photos), patroon van
`lib/useExpenses.js`. Signed photo-URLs lazy via het bestaande `signedPhotoUrl`-patroon.

### UI
- **Module-rename.** In `lib/modules.js`: de `activiteit`-descriptor wordt
  `{ key:'tijdlijn', label:'Tijdlijn', icon:'feed', route:'tijdlijn', kind:'data',
  table:'timeline_posts', creatorColumn:'author_id', core:false, primary:false, group:'huis' }`.
  Hernoem `app/(tabs)/activiteit.js` → `app/(tabs)/tijdlijn.js`. i18n: migreer `activity.*` →
  `timeline.*` in `lib/i18n.js` (titel "Tijdlijn", subtitle).
- **Feed-scherm** (`app/(tabs)/tijdlijn.js`): een `FlatList` van **grote bericht-kaarten**
  (auteur-avatar + naam + relatieve tijd, body, foto-galerij groot). `FAB` "nieuw bericht".
  Lege staat met illustratie. (De event-laag eronder komt in TML-5.)
- **Compose** (`app/tijdlijn/compose.js` of een `BottomSheet`): tekstveld + multi-foto-picker
  (`lib/photoPicker.js`, meerdere assets) + `VisibilityPicker`. Valideer body-of-foto vóór opslaan.
- **Detail** (`app/tijdlijn/[id].js` + `app/tijdlijn/_layout.js`): de post groot met
  volledige foto-galerij. (Reacties/comments komen in TML-3/TML-4.)

### Acceptatie
Een lid plaatst een bericht met tekst + meerdere foto's; het verschijnt bovenaan de tijdlijn met
grote foto's; niet-zichtbare berichten (subgroep) verschijnen niet bij anderen (RLS). `npm test`
groen, lint 0 errors. De oude Activiteit-route bestaat niet meer (vervangen door Tijdlijn).

---

## TML-2 — Berichten pinnen
`pinned_at`/`pinned_by` zijn er al (TML-1). Toevoegen: een pin-actie (header-menu of veegactie via
de bestaande `SwipeRow`) die `pinned_at = now()`/`null` zet; gepinde berichten staan bovenaan
(`orderTimeline` regelt de volgorde) met een pin-badge. **Wie mag pinnen:** elk lid dat de post mag
zien (write-policy = `is_member`); de owner kan altijd losmaken. Klein; geen migratie. Unit voor de
pin-tak van `orderTimeline` (rand: gepind-oud > ongepind-nieuw).

## TML-3 — Emoji-reacties (op berichten én systeem-events)
**`timeline_reactions`** — polymorf doelwit, één rij per (lid, doel, emoji), togglebaar:
```sql
create table if not exists public.timeline_reactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id    uuid not null references public.profiles(id),
  target_type  text not null check (target_type in ('post','event')),
  target_id    text not null,        -- post: timeline_posts.id ; event: '<bron_tabel>:<bron_id>'
  emoji        text not null,
  created_at   timestamptz not null default now(),
  unique (target_type, target_id, author_id, emoji)
);
```
**RLS-keuze:** basis = `is_member(household_id)` voor read/write (write bovendien
`author_id = auth.uid()`). Voor `target_type='post'` extra de `can_view`-check op de post (een
reactie mag niet lekken dat een niet-zichtbare post bestaat). Voor `target_type='event'` is de
huishouden-scope de guard: het event zelf verschijnt alleen in de feed van wie het via de bron-RLS
mag zien, dus de reactie-teller wordt nooit getoond aan iemand die het event niet ziet. *(Hardening
voor later: ook de bron-zichtbaarheid joinen — genoteerd, niet in deze stap.)*

Pure aggregatie in `lib/timeline.js`: `aggregateReactions(rows, viewerId)` →
`[{ emoji, count, mine }]`, gesorteerd op count desc dan emoji (assert de héle lijst + de `mine`-tak).
**Folding-interactie (belangrijk):** een systeem-event mét reacties wordt **niet** samengevouwen
(TML-5) — het krijgt een stabiel `reactionTarget` (`'<bron_tabel>:<bron_id>'` van de meest recente
rij). Alleen reactie-loze events vouwen samen. UI: emoji-picker (klein vast setje + "meer"),
teller-chips onder elk item. M; migratie.

## TML-4 — Tekstreacties / comments (alléén op berichten)
**`timeline_comments`** — kind-tabel onder `timeline_posts` (erft de post-zichtbaarheid):
```sql
create table if not exists public.timeline_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.timeline_posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
```
RLS als kind-tabel (SELECT via `can_view` op de parent-post; write `is_member` + `author_id =
auth.uid()`). Realtime do-block + index `(post_id, created_at)`. UI: comment-thread + invoerveld
onder het detail-scherm (TML-1). Systeem-events tonen géén comment-affordance (alleen emoji). M; migratie.

## TML-5 — Systeem-events als samenvouwbare laag
Bouwt de **upgrade van PLT-6**. Twee delen:
1. **Event-engine verbreden** (`lib/activity.js`): meer `FORMATTERS` naast `task_completed` —
   bv. `expense_added`, `grocery_added`, `plant_watered`, `pet_log`, `meal_planned`. Elk leidt af
   uit een bestaande bron-tabel (geen nieuwe tabel/triggers); elk een eigen NL-regel + icoon en —
   **DoD** — een eigen unit-test. De `useActivity`-fan-out wordt een union over de relevante
   bron-tabellen (of één aggregaat-RPC, vgl. `household_*_totals` uit migr. `0037`).
2. **Renderen als laag** in `app/(tabs)/tijdlijn.js`: onder de berichten een samenvouwbare sectie
   "Activiteit" (toggle "toon ook activiteit"), met de compacte event-regels (huidige
   `ItemRow`-stijl) — gevouwen via de bestaande `buildFeed`-foldlogica, met de TML-3-uitzondering
   (events met reacties vouwen niet). M; geen migratie (afgeleid). Mutatie-ratchet draaien (raakt `lib/activity.js`).

## TML-6 — Tijdlijn-instellingen: filter (module + event-type), twee lagen
De **instelbare** kant. Pure logica `lib/timelineFilter.js` + `tests/timelineFilter.test.js`,
gemodelleerd naar `effectiveModules` in `lib/modules.js`:
- `visibleOnTimeline(item, { householdDisabled, userDisabled })` per as (module-key, event-type).
  **DEFAULT-ON**: zichtbaar tenzij expliciet uitgezet; **huishouden-uitzetting wint** van de
  gebruiker. Roep 'm óók zónder config aan (default-param-mutant) en test de grens "huishouden uit
  ⇒ gebruiker kan niet terugzetten".

**Config-tabellen** (spiegelen `household_modules` / `user_module_prefs`, migr. `0004`):
```sql
create table if not exists public.household_timeline_prefs (
  household_id uuid not null references public.households(id) on delete cascade,
  axis  text not null check (axis in ('module','event_type','member','subgroup')),
  value text not null,            -- bv. 'boodschappen' (module) of 'grocery_added' (event_type)
  enabled boolean not null default true,
  primary key (household_id, axis, value)
);
create table if not exists public.user_timeline_prefs (
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  axis  text not null check (axis in ('module','event_type','member','subgroup')),
  value text not null,
  enabled boolean not null default true,
  primary key (household_id, profile_id, axis, value)
);
```
RLS exact als `0004`: huishouden-prefs leesbaar voor leden, schrijfbaar voor de owner;
user-prefs alleen je eigen rijen. Hook `lib/useTimelineFilters.js` (laden/opslaan, realtime).
Instellingenscherm met twee secties ("Voor het hele huishouden" / "Voor mij"): toggles per module
en per event-type. Bereikbaar vanuit de tijdlijn-header en/of `app/(tabs)/instellingen.js`. M; migratie.

## TML-7 — Filter per persoon/lid
Bouwt voort op de `axis='member'`-rijen uit TML-6: verberg activiteit/berichten van gekozen leden
(of toon alleen die van jezelf/een paar). `visibleOnTimeline` krijgt de member-as erbij (zelfde
twee-lagen-regel); UI: een ledenlijst met toggles in het instellingenscherm. S; geen extra migratie.

## TML-8 — Filter per zichtbaarheid/subgroep  *(gate: FND-1)*
De `axis='subgroup'`-as. Pas zinvol zódra subgroepen bestaan (FND-1). Twee lagen: toon alleen items
die aan een gekozen subgroep hangen (bovenop de RLS-zichtbaarheid, dit is een **weergave**-filter,
geen beveiliging — de RLS doet de echte afscherming). M/L; leunt op FND-1 + de bestaande
`visibility`/`share_subgroup_id` op `timeline_posts`. **Bewust uitgesteld tot FND-1 er is.**

---

## File-checklist (cumulatief over de stappen)

**Nieuw**
- `supabase/migrations/00XX_tijdlijn.sql` (TML-1; reactions/comments/filter-prefs eventueel in
  losse opvolg-migraties per stap)
- `lib/timeline.js` + `tests/timeline.test.js`
- `lib/timelineFilter.js` + `tests/timelineFilter.test.js`
- `lib/useTimeline.js`, `lib/useTimelineFilters.js`
- `app/(tabs)/tijdlijn.js` (vervangt `activiteit.js`), `app/tijdlijn/[id].js`,
  `app/tijdlijn/compose.js`, `app/tijdlijn/_layout.js`
- bucket `timeline` (in de migratie) + RLS

**Gewijzigd**
- `lib/modules.js` — `activiteit`-descriptor → `tijdlijn` (kind `data`, table `timeline_posts`)
- `lib/activity.js` — extra `FORMATTERS` + multi-bron-events (TML-5) — **mutatie-ratchet draaien**
- `lib/i18n.js` — `activity.*` → `timeline.*`
- `lib/useActivity.js` — fan-out over meerdere bron-tabellen (of opgaan in `useTimeline.js`)
- `app/(tabs)/instellingen.js` — entree naar de tijdlijn-filterinstellingen
- `mutation-baseline.json` — `timeline`/`timelineFilter` toevoegen (vgl. INF-11)
- `tests/rls.integration.test.js` — cases voor `timeline_photos`/`timeline_comments` (kind-erving)
  en `timeline_reactions` (member-scope + post-`can_view`)

## Acceptatie (geheel)
Berichten met grote foto's vormen de hoofdmoot van de tijdlijn; gepinde berichten staan bovenaan;
emoji-reacties werken op berichten én systeem-events; geschreven reacties alleen op berichten;
de activiteit staat als samenvouwbare laag eronder; en zowel het huishouden als het individuele lid
kan via instellingen per module/event-type/persoon (en later subgroep) bepalen wat er verschijnt.
RLS scopet alles; `npm test` + mutatie-ratchet + `npx eslint .` groen vóór elke PR.
