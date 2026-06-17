# 🏡 Huishoek

Eén plek voor het hele huishouden: klusjes, huishoudelijke taken, planten water geven,
afspraken en de boodschappenlijst — samen geregeld, live gesynchroniseerd over alle
apparaten. Werkt op **iOS, Android en web** vanuit één codebase (Expo / React Native),
met **Supabase** als backend (auth, database, realtime).

---

## Wat het kan

- **Meerdere huishoudens** — een gezin, huisgenoten, of een groep. Je kunt in meerdere
  huishoudens zitten en ertussen wisselen.
- **Uitnodigen via code** — elk huishouden heeft een 6-tekens code; deel 'm en anderen
  sluiten direct aan.
- **Groepen (subgroepen)** — maak binnen een huishouden vaste groepjes zoals "Ouders" of
  "Voetbal Tim", beheerd op het tabblad Huishouden.
- **Delen per item** — elke taak heeft een "Delen met"-keuze: het hele huishouden
  (standaard), een groep, of een los gekozen setje personen. Zo zien de kinderen niet
  alles van de ouders, en blijft de training van het ene kind buiten beeld bij het ander.
  De maker ziet zijn eigen item altijd.
- **Taken** met categorieën: 🔧 klusje, 🧹 huishouden, 🪴 plant, 📅 afspraak, 📌 overig.
- **Toewijzen** aan een specifiek lid of aan iedereen.
- **Eenmalig én terugkerend** — dagelijks, wekelijks (met specifieke weekdagen),
  of maandelijks. Bij afvinken verschijnt automatisch de volgende keer.
- **Vandaag-overzicht** met achterstallige, vandaag-, en afgeronde taken.
- **Gedeelde boodschappenlijst** — live, met afvinken en in één keer wissen.
- **Realtime** — wijzigingen van een gezinslid verschijnen meteen bij de rest.
- Volledige **Row Level Security**: leden zien alléén hun eigen huishouden(s), en binnen
  een huishouden alléén de items die met hen gedeeld zijn.

---

## Snel starten

### 1. Supabase-project opzetten
1. Maak een gratis project op [supabase.com](https://supabase.com).
2. Open **SQL Editor** en plak de volledige inhoud van
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql). Run het.
   Dit maakt alle tabellen, beveiliging (RLS), de invite-functie en realtime aan.
   (`supabase/schema.sql` is alleen een wegwijzer naar de migraties — toekomstige
   wijzigingen komen als nieuwe, genummerde migraties erbij.)
3. (Optioneel maar aan te raden) Plak daarna
   [`supabase/tests/can_view_test.sql`](./supabase/tests/can_view_test.sql) en run het.
   Het controleert de zichtbaarheidsregels (wie ziet wat) en draait zichzelf terug —
   je database blijft schoon, maar je weet zeker dat de beveiliging klopt.
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
```

### 3. Installeren en starten
```bash
npm install
npx expo start
```
Daarna:
- **Telefoon** — installeer *Expo Go* en scan de QR-code.
- **Web** — druk `w` in de terminal (of `npx expo start --web`).
- **iOS-simulator** — druk `i`. **Android-emulator** — druk `a`.

> Tip: maak twee accounts (bv. via web + telefoon), laat de één een huishouden
> aanmaken en deel de code met de ander. Voeg een boodschap toe en zie 'm live
> verschijnen aan de andere kant.

### 4. Tests draaien (aanrader voor je verder bouwt)
```bash
npm test
```
Dit controleert de herhaal-logica (dagelijks/wekelijks/maandelijks, ook met specifieke
weekdagen) met Node's ingebouwde testrunner — geen extra dependencies. Voeg hier tests
aan toe als je nieuwe pure logica schrijft (zoals later bij de boodschappen- of
plantenmodule); zie `tests/recurrence.test.js` als voorbeeld.

---

## Projectstructuur

```
huishoek/
├── app/                          # Schermen (expo-router, file-based routing)
│   ├── _layout.js                # Providers + auth-gate (stuurt naar login/onboarding/app)
│   ├── (auth)/welcome.js         # Inloggen & registreren
│   ├── onboarding.js             # Huishouden aanmaken of aansluiten via code
│   ├── (tabs)/
│   │   ├── _layout.js            # Tabbalk
│   │   ├── vandaag.js            # Dagoverzicht: achterstallig / vandaag / klaar
│   │   ├── taken.js              # Alle taken, filterbaar op categorie & status
│   │   ├── boodschappen.js       # Gedeelde, realtime boodschappenlijst
│   │   └── huishouden.js         # Leden, groepen, invite-code, wisselen, uitloggen
│   └── task/
│       ├── _layout.js            # Modal-stack voor de taak-editor
│       └── [id].js               # Taak toevoegen/bewerken + "Delen met" (id="new" = nieuw)
├── lib/
│   ├── supabase.js               # Supabase-client (platform-aware opslag)
│   ├── auth.js                   # Auth-context (sessie + profiel)
│   ├── household.js              # Huishouden-context: huishoudens, leden, groepen
│   ├── useTasks.js                # Taken-hook met realtime + herhaal-logica
│   ├── recurrence.js             # Volgende-datum berekening + labels
│   ├── constants.js               # Eén bron van waarheid: categorieën, zichtbaarheid, herhaling
│   ├── db.js                      # Dunne helper: fouten zichtbaar maken i.p.v. negeren
│   ├── theme.js                   # Designtokens (kleuren, type, categorie-metadata)
│   ├── ui.js                      # Herbruikbare componenten (Button, Field, Card…)
│   └── TaskRow.js                 # Eén taakregel (incl. 🔒-indicator bij beperkt delen)
├── supabase/
│   ├── schema.sql                 # Wegwijzer — de waarheid leeft in migrations/
│   ├── migrations/
│   │   └── 0001_init.sql          # Volledige database + RLS + groepen + delen-model
│   └── tests/
│       └── can_view_test.sql      # Test voor de zichtbaarheidsregels (rollback, geen sporen)
├── tests/
│   ├── recurrence.test.js         # Tests voor de herhaal-logica (npm test)
│   ├── register.mjs               # Bootstrap die de module-resolver registreert
│   └── loader.mjs                 # Resolver: laat Node extensieloze imports begrijpen
├── app.config.js                  # Expo-config (leest .env)
├── babel.config.js
├── .env.example
└── package.json
```

---

## Hoe het datamodel werkt

- **profiles** — 1-op-1 met `auth.users`, automatisch aangemaakt bij registratie.
- **households** — een huishouden met een unieke `invite_code`.
- **household_members** — koppelt profielen aan huishoudens (rol: owner/member).
- **tasks** — taken met categorie, toewijzing, datum/tijd, en herhaling
  (`recur_freq` + `recur_interval` + `recur_weekdays`). `null` herhaling = eenmalig.
- **groceries** — boodschappen per huishouden.
- **subgroups** + **subgroup_members** — herbruikbare groepjes binnen een huishouden.

### Delen per item

Elke taak (en boodschap) draagt een zichtbaarheid via drie velden:
`visibility` (`household` | `subgroup` | `custom`), `share_subgroup_id`, en `share_with`
(een array van profiel-ids). De RLS-functie `can_view()` bepaalt op één plek wie een item
mag zien:

- `household` (standaard) → iedereen in het huishouden;
- `subgroup` → de leden van de gekoppelde groep, plus de maker;
- `custom` → de personen in `share_with`, plus de maker.

Omdat meerdere permissive RLS-policies in Postgres met OR worden gecombineerd, zijn de
schrijf-policies (insert/update/delete) bewust gescheiden van de SELECT-policy. Anders zou
de huishoud-brede schrijfcheck de zichtbaarheidsregel bij lezen omzeilen.

Alle tabellen hebben **Row Level Security**: een `is_member()`-functie zorgt dat je
alleen data van huishoudens ziet waar je lid van bent. Toetreden gaat via de
beveiligde RPC `join_household(code)`.

---

## Terugkerende taken

Een terugkerende taak houdt zichzelf "levend": vink je 'm af, dan wordt de
vervaldatum verzet naar de volgende keer in plaats van als afgerond gemarkeerd.
De berekening staat in `lib/recurrence.js` (`nextDueDate`), is gevalideerd voor
dagelijks/wekelijks/maandelijks en voor wekelijks met specifieke dagen.

---

## Volgende stappen (bewust nog niet gebouwd)

Dit is een volwaardig, werkend fundament. Logische uitbreidingen:

- **Push-notificaties** (`expo-notifications`) voor herinneringen op de vervaltijd.
- **Avatar/profiel bewerken** (emoji-keuze staat klaar in het datamodel).
- **Beloningen/punten** per voltooide taak voor gezinnen met kinderen.
- **Boodschap-categorieën & sortering** per schap (kolom bestaat al in de DB).
- **Native datum/tijd-picker** i.p.v. de huidige stepper (`@react-native-community/datetimepicker`).
- **Kinderprofielen** zonder volwaardige login (open vraag, raakt privacy én groepen-RLS).
- **Dunne datalaag per module** als er meer modules bijkomen (nu praat elk scherm nog
  direct met Supabase; dat is bij 2 modules prima maar wordt rommelig bij 5+).

---

Gemaakt als compleet startpunt — kloon, vul je Supabase in, en bouw verder. 🛠️
