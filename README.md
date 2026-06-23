# 🏡 Huishoek

Eén plek voor het hele huishouden: klusjes, huishoudelijke taken, schoonmaakroosters,
planten, afspraken, de boodschappenlijst én wie-betaalt-wat — samen geregeld, live
gesynchroniseerd over alle apparaten. Werkt op **iOS, Android en web** vanuit één
codebase (Expo / React Native), met **Supabase** als backend (auth, database, realtime,
storage).

---

## Wat het kan

**Fundament**
- **Meerdere huishoudens** — een gezin, huisgenoten, of een groep. Je kunt in meerdere
  huishoudens zitten en ertussen wisselen.
- **Uitnodigen via code** — elk huishouden heeft een 6-tekens code; deel 'm en anderen
  sluiten direct aan.
- **Groepen (subgroepen)** — maak binnen een huishouden vaste groepjes zoals "Ouders" of
  "Voetbal Tim", beheerd op het tabblad Huishouden.
- **Delen per item** — elk item heeft een "Delen met"-keuze: het hele huishouden
  (standaard), een groep, of een los gekozen setje personen. Zo zien de kinderen niet
  alles van de ouders, en blijft de training van het ene kind buiten beeld bij het ander.
  De maker ziet zijn eigen item altijd.
- **Modules aan/uit** — elke module is toggle-baar per huishouden én per gebruiker
  (default aan). De minder-gebruikte modules staan onder een **"Meer"-overflowtab** zodat
  de tabbalk leesbaar blijft.

**Modules**
- **Taken** met categorieën (🔧 klusje, 🧹 huishouden, 🪴 plant, 📅 afspraak, 📌 overig),
  toewijzing aan een lid of iedereen, en herhaling (dagelijks / wekelijks met specifieke
  weekdagen / maandelijks). Bij afvinken verschijnt automatisch de volgende keer.
  Inclusief een **klus-bibliotheek** met veelvoorkomende klussen (rookmelder testen,
  cv-druk, ontkalken…) en **seizoenssuggesties** die met één tik een taak met passend
  ritme toevoegen.
- **Vandaag** — dagoverzicht met achterstallige, vandaag- en afgeronde taken.
- **Agenda** — echte maandkalender met subgroep-/categoriefilter (eigen date-fns-grid,
  geen native library).
- **Schoonmaak** — kamer-/zonegerichte taken en een **weekschema** dat je in één keer
  opzet vanuit regelgebaseerde sjablonen.
- **Boodschappen** — gedeelde, realtime lijst met afvinken.
- **Kosten / WieBetaaltWat** — uitgaven splitsen (gelijk / op aandeel / exact), een
  saldo-overzicht en een **vereffen-suggestie** die het aantal onderlinge betalingen
  minimaliseert.
- **Planten** — soortdatabase met regelgebaseerd verzorgingsschema (water/voeding als
  terugkerende taken), een verzorgingskaart, foto's via private Storage en een
  **plantendagboek** (foto's over tijd; de nieuwste is automatisch de omslag).

**Platform**
- **Realtime** — wijzigingen van een gezinslid verschijnen meteen bij de rest.
- **Design-/icon-systeem** — één set tokens (`lib/theme.js`) en componenten (`lib/ui.js`)
  met Phosphor-iconen (`lib/icons.js`); toegankelijk by default (48dp-targets, contrast,
  font-scaling) en met een **licht/donker-thema** (systeem/licht/donker, instelbaar in
  Beeldstijl). Zie [DESIGN.md](./DESIGN.md).
- Volledige **Row Level Security**: leden zien alléén hun eigen huishouden(s), en binnen
  een huishouden alléén de items die met hen gedeeld zijn.

> De volledige productbacklog met status per item staat in
> [`huishoek-backlog.md`](./huishoek-backlog.md); de uitgewerkte Fase 1-specs in
> [`huishoek-specs-fase1.md`](./huishoek-specs-fase1.md).

---

## Snel starten

### 1. Supabase-project opzetten
1. Maak een gratis project op [supabase.com](https://supabase.com).
2. Voer **alle migraties** uit `supabase/migrations/` uit (in volgorde `0001` → `0011`).
   De aanrader is de Supabase CLI:
   ```bash
   npx supabase login                       # of: export SUPABASE_ACCESS_TOKEN=sbp_...
   npx supabase link --project-ref <jouw-ref>
   npx supabase db push                     # past 0001..0011 toe
   ```
   Geen CLI? Plak elke migratie in volgorde in de **SQL Editor** en run ze. Dit maakt
   alle tabellen, RLS, de invite-functie, het module-framework, de modules en de
   `plants`-storagebucket aan. Migratie `0009` seedt ~30 plantensoorten.
   (`supabase/schema.sql` is alleen een wegwijzer naar de migraties.)
3. (Optioneel) Plak [`supabase/tests/can_view_test.sql`](./supabase/tests/can_view_test.sql)
   en run het — het controleert de zichtbaarheidsregels en draait zichzelf terug.
4. Ga naar **Project Settings → API** en kopieer de **Project URL** en de **anon public key**.
5. (Aanrader voor testen) Zet onder **Authentication → Providers → Email** de optie
   "Confirm email" uit, zodat je direct kunt inloggen zonder mailbevestiging.

### 2. App configureren
```bash
cp .env.example .env
```
Vul je gegevens in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://jouwproject.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Alleen nodig om de RLS-integratietests te draaien (niet voor de app zelf):
SUPABASE_SERVICE_ROLE_KEY=
```

### 3. Installeren en starten
```bash
npm install
npx expo start
```
Daarna:
- **Telefoon** — installeer *Expo Go* en scan de QR-code (LAN, of `npx expo start --tunnel`).
- **Web** — druk `w` in de terminal (of `npx expo start --web`).
- **iOS-simulator** — druk `i`. **Android-emulator** — druk `a`.

> Tip: maak twee accounts (bv. via web + telefoon), laat de één een huishouden
> aanmaken en deel de code met de ander. Voeg een boodschap toe en zie 'm live
> verschijnen aan de andere kant.

### 4. Tests draaien (aanrader voor je verder bouwt)
```bash
npm test
```
Node's ingebouwde testrunner draait de pure logica (herhaling, agenda-grid, schoonmaak-
en klus-sjablonen, kostensplitsing, verzorgingsschema, zichtbaarheid). De
RLS-**integratietests** skippen zichzelf zonder Supabase-secrets; zet
`SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` om ze écht tegen een
test-/staging-database te draaien (zie [VERIFICATIE.md](./VERIFICATIE.md)). Voeg een
test toe als je nieuwe pure logica schrijft; zie `tests/recurrence.test.js` als voorbeeld.

---

## Projectstructuur

```
huishoek/
├── app/                          # Schermen (expo-router, file-based routing)
│   ├── _layout.js                # Providers + auth-gate
│   ├── (auth)/welcome.js         # Inloggen & registreren
│   ├── onboarding.js             # Huishouden aanmaken of aansluiten via code
│   ├── (tabs)/                   # Tabbalk + Meer-overflowtab
│   │   ├── vandaag.js            #   Dagoverzicht
│   │   ├── taken.js              #   Alle taken + klus-bibliotheek
│   │   ├── agenda.js             #   Maandkalender met subgroep-filter
│   │   ├── boodschappen.js       #   Gedeelde, realtime lijst
│   │   ├── schoonmaak.js         #   Zones + weekschema
│   │   ├── kosten.js             #   WieBetaaltWat: uitgaven & saldo
│   │   ├── planten.js            #   Plantenlijst met foto-omslag
│   │   ├── huishouden.js         #   Leden, groepen, invite-code, modules
│   │   └── meer.js               #   Overflow-navigatie
│   ├── task/[id].js              # Taak toevoegen/bewerken + "Delen met"
│   ├── expense/[id].js           # Uitgave toevoegen/bewerken + splitsen
│   └── plant/[id].js             # Plantdetail: verzorgingskaart + dagboek
├── lib/
│   ├── supabase.js · auth.js · household.js · db.js   # Client, contexten, foutafhandeling
│   ├── useCollection.js          # Generieke huishouden-gescopete CRUD + realtime
│   ├── useTasks/useGroceries/useZones/useExpenses/usePlants.js  # Module-hooks
│   ├── recurrence.js             # Volgende-datum berekening + labels
│   ├── agenda.js · cleaningTemplates.js · choreLibrary.js       # Pure module-logica
│   ├── expenses.js · plantCare.js · plantPhoto.js               # (volledig getest)
│   ├── visibility.js · modules.js · constants.js               # Contract & bron van waarheid
│   ├── theme.js · icons.js · ui.js                             # Design-systeem
│   └── TaskRow.js · VisibilityPicker.js · ChoreLibrarySheet.js # Gedeelde componenten
├── supabase/
│   ├── schema.sql                # Wegwijzer — de waarheid leeft in migrations/
│   ├── migrations/0001..0011.sql # Schema, RLS, framework, modules, storage, seed
│   └── tests/can_view_test.sql   # Test voor de zichtbaarheidsregels (rollback)
├── tests/                        # node:test units + RLS-integratietests
├── .github/workflows/ci.yml      # CI: npm test op elke push/PR
├── app.config.js · babel.config.js · metro.config.js
└── package.json
```

---

## Modules & architectuur

Nieuwe modules "pluggen in" op een gedeeld contract, zodat ze niet steeds laden, realtime
en CRUD opnieuw uitvinden:

- **Module-contract** — een tabel met `household_id`, een creator-kolom en de
  zichtbaarheidskolommen (`visibility` / `share_subgroup_id` / `share_with`). Eén SQL-
  aanroep `select public.enable_module_rls('<tabel>', '<creator_col>')` zet RLS, de vier
  policies (via `can_view`), de subgroep-integriteitstrigger en realtime aan. Zie
  [`0003_module_framework.sql`](./supabase/migrations/0003_module_framework.sql).
- **`useCollection(table, opts)`** ([lib/useCollection.js](./lib/useCollection.js)) —
  gescopet laden, een realtime-subscription en `create/update/remove` met nette
  foutafhandeling. Module-hooks (`useTasks`, `useExpenses`, …) bouwen hierop voort.
- **Snelle (her)bezoeken** — hooks seeden hun begintoestand uit een lichte in-memory
  cache ([lib/dataCache.js](./lib/dataCache.js), stale-while-revalidate, gekeyd op
  `tabel:householdId`) zodat een herbezochte tab geen laad-skelet toont, en patchen platte
  collecties incrementeel op realtime-events ([lib/realtimePatch.js](./lib/realtimePatch.js))
  i.p.v. een volledige refetch. De `Tabs` staan op `freezeOnBlur` (state-behoud).
- **Pure logica los getest** — de "slimme" laag van elke module (herhaling, agenda-grid,
  sjablonen, splitsing, verzorgingsschema) zit in losse bestanden zonder React/Supabase,
  met units onder `tests/`.

### Delen per item

Elk item draagt een zichtbaarheid via drie velden: `visibility`
(`household` | `subgroup` | `custom`), `share_subgroup_id`, en `share_with` (een array van
profiel-ids). De RLS-functie `can_view()` bepaalt op één plek wie een item mag zien:

- `household` (standaard) → iedereen in het huishouden;
- `subgroup` → de leden van de gekoppelde groep, plus de maker;
- `custom` → de personen in `share_with`, plus de maker.

Omdat meerdere permissive RLS-policies in Postgres met OR worden gecombineerd, zijn de
schrijf-policies (insert/update/delete) bewust gescheiden van de SELECT-policy. Anders zou
de huishoud-brede schrijfcheck de zichtbaarheidsregel bij lezen omzeilen. `lib/visibility.js`
spiegelt `can_view()` in JS, zodat de UI lokaal kan filteren en de regels te unit-testen zijn.

---

## Datamodel (hoofdtabellen)

- **profiles** — 1-op-1 met `auth.users`, automatisch aangemaakt bij registratie.
- **households** / **household_members** — huishoudens met `invite_code` en leden (owner/member).
- **subgroups** / **subgroup_members** — herbruikbare groepjes binnen een huishouden.
- **tasks** — taken met categorie, toewijzing, datum/tijd en herhaling; plus `zone_id`
  (schoonmaak) en `plant_id` (verzorgingstaken).
- **groceries** — boodschappen per huishouden.
- **zones** — schoonmaakzones per huishouden.
- **expenses** / **expense_shares** — uitgaven en hun (berekende) deelbedragen; `shares`
  erven de zichtbaarheid van hun parent-uitgave.
- **plant_species** (globaal, geseed), **plants**, **plant_photos** (dagboek; erft de
  zichtbaarheid van de parent-plant).

Toetreden tot een huishouden gaat via de beveiligde RPC `join_household(code)`; uitgaven
worden atomair aangemaakt via `create_expense(...)`.

---

## Terugkerende taken

Een terugkerende taak houdt zichzelf "levend": vink je 'm af, dan wordt de vervaldatum
verzet naar de volgende keer in plaats van als afgerond gemarkeerd. De berekening staat in
[`lib/recurrence.js`](./lib/recurrence.js) (`nextDueDate`), gevalideerd voor
dagelijks/wekelijks/maandelijks en voor wekelijks met specifieke dagen.

> Let op: omdat een terugkerende taak doorrolt, bewaart hij geen geschiedenis van wie 'm
> wanneer afvinkte (`completed_by` wordt bij het doorrollen gewist). Een eerlijkheids-/
> beurtoverzicht (SCH-3) vraagt daarom een aparte voltooiings-log; zie de backlog.

---

## Volgende stappen

Fase 0 (fundament) en Fase 1 (Agenda, Schoonmaak, Kosten, Planten) zijn gebouwd. De
geplande uitbreidingen — boodschappen-bonnetjes & prijstracker, grote-aankopen-dossiers,
beurtrotatie/eerlijkheid, kosten-koppeling, autodelen, en de slimme AI-features — staan
met status, prioriteit en aanpak in [`huishoek-backlog.md`](./huishoek-backlog.md).

**Build-ready implementatieplannen** voor de volgende ronde (met migratie-SQL, pure logica
+ tests, hooks, schermen, RLS en file-checklists) staan in
[`docs/plans/`](./docs/plans/00-overzicht.md) — direct oppakbaar in VSC.

> **Status & roadmap (single source of truth):** [`huishoek-backlog.md`](./huishoek-backlog.md)
> §6 — de enige plek voor wat af/open is. Migratie-/RLS-runbook: [`VERIFICATIE.md`](./VERIFICATIE.md)
> (+ `docs/rls-connector-check.sql` voor verificatie zonder secrets). De eenmalige architectuur-/
> security-/performance-audit staat in [`docs/audit-2026-06-21.md`](./docs/audit-2026-06-21.md)
> (historische analyse; status leeft in de backlog).

---

Gemaakt als compleet startpunt — kloon, vul je Supabase in, en bouw verder. 🛠️
