# Verificatie-runbook — Fase 1 modules tegen live Supabase

> **Status (bijgewerkt 2026-06-22).** Alle migraties `0001`–`0036` zijn live (**DB op `0036`**),
> geverifieerd via `list_migrations` (36 versies; `0035` = `plant_diary_note`, `0036` = `home_layout`,
> beide toegepast op 2026-06-22). De kern-RLS + RPC's zijn
> bewezen via **`docs/rls-connector-check.sql`** (13/13, zonder secrets). **Nog open:** de
> volledige JS-RLS-suite met secrets (18 stuks skippen zonder secrets), de PLT-1 trap 2 flip-on
> via `docs/notify-setup.md`, en de 2-account-rooktest in Stap 3 onderaan. De canonieke status
> staat in **`huishoek-backlog.md`** §6 (INF-1). De stappen 1–2 hieronder blijven het herhaalrecept
> telkens als er een migratie bijkomt.
>
> **De secrets staan lokaal in `.env`** (alle drie: `EXPO_PUBLIC_SUPABASE_URL`,
> `EXPO_PUBLIC_SUPABASE_ANON_KEY` én `SUPABASE_SERVICE_ROLE_KEY`). De CLI is op deze
> machine ingelogd en gekoppeld. Het hele recept is daarmee één commando per stap —
> zie de "Snelrecept (deze machine)" hieronder; je hoeft niets te plakken.
>
> **Draaien vanuit Claude Code on the web?** De secrets zitten niet in de remote
> container (geen `.env`, env-vars leeg) en de CLI is daar niet ingelogd. Om het tóch
> remote te draaien: zet `SUPABASE_ACCESS_TOKEN` (vervangt `supabase login`),
> `SUPABASE_DB_PASSWORD` en `SUPABASE_SERVICE_ROLE_KEY` + de twee `EXPO_PUBLIC_*`
> als **environment variables** in de environment-config, en zet network access op
> **Custom** met `api.supabase.com`, `*.supabase.co` en `*.pooler.supabase.com` op de
> allowlist (Supabase staat niet in de default-allowlist). Anders falen login/push/tests
> op netwerkniveau. Gebruik een test-/staging-project, geen productie.

## Snelrecept (deze machine — secrets in `.env`, CLI ingelogd)

`node` en `supabase` staan niet op het default-PATH; prefix ze. Vanuit de projectroot:

```bash
NODE_BIN="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" | tail -1)/bin"

# 1. Nieuwe migratie(s) live pushen (idempotent; slaat reeds-toegepaste over).
PATH="/opt/homebrew/bin:$PATH" supabase db push

# 2. Volledige suite incl. RLS-integratietests tegen de live DB. Leest alle drie de
#    secrets uit .env; mapt de EXPO_PUBLIC_*-namen naar de namen die de test verwacht.
set -a; . ./.env; set +a
PATH="$NODE_BIN:$PATH" \
  SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" \
  SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  npm test
```

Verwacht: **alle tests groen, 0 skipped** (de RLS-tests draaien i.p.v. skippen).
De RLS-tests maken tijdelijke `rlstest+<timestamp>@example.com`-gebruikers aan en
ruimen die na afloop op. De rest van dit document is de uitgebreide naslag.

> **Geen secrets/egress (bv. Claude Code op het web)?** De JS-RLS-suite kan dan niet
> draaien (egress-allowlist blokkeert `*.supabase.co`, en de service-role-key is niet
> via de Supabase-connector beschikbaar). Gebruik dan **`docs/rls-connector-check.sql`**:
> die verifieert de kern-RLS rechtstreeks via de connector met rol-/JWT-impersonatie en
> rolt alles terug (geen persistentie). Laatst gedraaid 2026-06-21 → **7/7 PASS**.

---

De pure logica is volledig getest met `npm test` (groen). Twee dingen vereisen
credentials die bewust niet in de repo staan; doe ze lokaal (VSC, waar je al bent
ingelogd) of remote zoals hierboven beschreven:

1. nieuwe migraties naar het hosted project pushen (de huidige set `0004`–`0011` staat er al op);
2. de RLS-integratietests tegen de echte database draaien.

Hieronder de exacte stappen. Je hebt twee dingen nodig die alleen jij hebt:
- het **database-wachtwoord** (eenmalig getoond bij het aanmaken van het project);
- de **service-role-key** (Dashboard → Project Settings → API → `service_role`).

> ⚠️ Plak de service-role-key **niet** in een chat of commit. Gebruik 'm alleen
> lokaal als omgevingsvariabele, tegen het test-/staging-gebruik van het project.

Project: `huishoek`, ref `nayqbzekpdyigvfcroxd` (eu-central-1). Al gekoppeld
(`supabase/.temp/project-ref`).

---

## Stap 1 — Migraties pushen

> De CLI op deze machine is **niet ingelogd** (gecontroleerd: "Access token not
> provided"). Daarom eerst inloggen. `supabase login` opent je browser — dat is
> de stap die ik niet voor je kan doen.

```bash
cd /Users/evdniet/code/huishoek/smol-test

# 1a. CLI-login (eenmalig; opent de browser). Alternatief zonder browser:
#     maak een Personal Access Token op supabase.com/dashboard/account/tokens en
#     zet 'm als:  export SUPABASE_ACCESS_TOKEN=sbp_...
npx --yes supabase@latest login

# 1b. Pushen. Vraagt om het database-wachtwoord (eenmalig getoond bij aanmaken).
#     Pusht alles wat nog niet is toegepast — verwacht 0004..0009 (de live DB
#     staat blijkens de app-logs nu nog op 0003).
npx --yes supabase@latest db push
```

> Wil je dat ík de push draai i.p.v. jij? Dat kan alléén non-interactief met twee
> van jouw secrets in de omgeving (ze belanden dan wel in deze sessie/log):
> ```bash
> SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_DB_PASSWORD=... npx --yes supabase@latest db push
> ```
> Veiliger is de twee commando's hierboven zelf te draaien.

---

## Te-verifiëren-batch — de open 🔧's in één device-sessie

> **Waarom deze sectie.** De backlog §6 telt veel `🔧 Te verifiëren`-items (gebouwd, wacht op
> een toestelcheck). Om te voorkomen dat die kolom dichtslibt, geldt de **verificatie-ratchet**
> (backlog §6-spelregels): staat de 🔧-teller boven ~10, dan is de eerstvolgende device-sessie
> een **batch** langs onderstaande lijst — geen nieuw bouwwerk. Eén dev-build + USB-sessie op de
> moto (zie [`memory: expo-local-devbuild`] / `adb reverse`-recept) dekt het meeste in één keer.
> Vink af; een bevestigd item → backlog ✅ → archief.

**A. Geen dev-build nodig (web of bestaande build)**
- [ ] **STR-10** — de laatste 6 illustratie-scènes visueel nalopen (alle hoofdtabs, beide thema's).
- [ ] **PERF-2** — tab-wissel-soepelheid op **web** (toestel is al bevestigd 2026-06-25).

**B. Dev-build + 2 accounts in één huishouden (tenant-isolatie + realtime)**
- [ ] **SEC-1** — met account B: `insert household_members` op een vreemd `household_id` → **deny**;
      `create_household`-RPC maakt household + owner-membership atomair aan.
- [ ] **SEC-4** — niet-owner `update households … set invite_code` → **deny**; owner wél.
- [ ] **INF-1 / INF-12** — volledige JS-RLS-suite **18/18** (na de INF-12 batch/backoff-fix) +
      de 2-account-rooktest uit Stap 3 onderaan.
- [ ] **INF-8** — realtime-patch + gebundelde household-subscriptie **2-richtingen** (wijziging op
      A verschijnt incrementeel op B).
- [ ] **BOO-11 / PLT-6 / HUI-1 / TKN-2** — realtime bijwerken bevestigen (vaste boodschappen,
      activiteitenfeed, huisdier-tijdlijn, heatmap).

**C. Dev-build, één toestel**
- [x] **ARCH-1** — uitgave-editor (`app/expense/[id].js`, omgezet naar `useEntityForm`):
      nieuw + bewerken opslaan, en elke validatie-melding tonen — leeg omschrijving, bedrag ≤ 0,
      geen betaler, geen deelnemers, exact-split die niet sluit, en een ongeldige zichtbaarheid.
      Gedragsneutrale conversie; dit bevestigt dat de gedeelde validatie identiek werkt.
      **✅ Device 2026-06-26 (moto):** nieuw opslaan (`addExpense`) + laden/bewerken/opslaan
      (`updateExpense`) werken; de gedeelde `runRules` vuurt omschrijving-, bedrag- en
      deelnemers-meldingen tegelijk, en een niet-sluitende exact-split blokkeert opslaan
      (inline rode "Nog te verdelen"-cue; de editor rendert géén losse `errors.exact`-regel).
      *Niet uitgelokt:* `paidBy` (defaultt op self, niet te deselecteren via AvatarSelect) en
      `visibility` (huishouden hééft een subgroep) — beide via dezelfde `runRules`/unit-tests gedekt.
- [x] **SEC-3** — `adb shell run-as app.huishoek` → de AsyncStorage-sqlite (`RKStorage`) bevat
      **geen** `sb-…-auth-token` meer; SecureStore wél.
      **✅ Device 2026-06-26 (moto):** `RKStorage` bevat enkel `huishoek.notifPrefs/themePrefs/widgetStyle`
      (0× auth-token); `SecureStore.xml` bevat het token **gechunkt** (`key_v1-sb-…-auth-token.0/.1/__n`).
- [ ] **BOO-9** — `expo-camera`-scannerscherm + scan-knop op Boodschappen/Voorraad.
- [ ] **BOO-10** — bestaande bon openen via "Bewerken" en opslaan.
      **⚠️ Geblokkeerd 2026-06-26:** in héél `app/`+`lib/` bestaat alléén `router.push('/purchase/new')` —
      er is **geen** navigatie naar een bestaande bon (`/purchase/<id>`). De read-only "Bewerken"-tak
      in [`app/purchase/[id].js`](app/purchase/[id].js) (rgl. 169+) is dus niet bereikbaar via de UI.
      Niet "rest: op toestel" maar **entry-point ontbreekt** — eerst inbouwen (bv. vanuit de
      activiteitenfeed of een bonnenlijst), dan rooktesten.
- [ ] **MLT-3** — recept-omslagfoto kiezen/uploaden/tonen.
      **◐ Device 2026-06-26 (moto):** *tonen* ✓ ("Pasta pest" toont z'n cover) en de Galerij-picker
      **opent** (systeem-`com.google.android.photopicker`). Het daadwerkelijke kiezen/uploaden bewust
      **niet** uitgevoerd — ik upload geen willekeurige persoonlijke galerij-foto naar de gedeelde
      cloud-opslag zonder dat Erik kiest wélke. **Gotcha gevonden:** een Android-config-change die de
      Activity herrijst (bv. nav-modus wisselen) breekt `expo-image-picker`'s ActivityResultLauncher
      ("unregistered ActivityResultLauncher") tot een app-herstart — geen app-bug, wel goed om te weten.
- [ ] **HUI-1** — foto kiezen/uploaden, checklist-flow, tijdlijn + gewicht-log.
- [x] **TKN-2** — heatmap rendering + scroll (jankt het → SVG-variant, zie §6-notitie).
      **✅ Device 2026-06-26 (moto):** Inzichten-heatmap rendert mét data (102 voltooiingen, gevulde
      cellen, streak-stats); horizontaal scrollen door de maanden is **soepel** — `gfxinfo`: 4,98%
      janky frames, p90 19ms / p95 21ms. **Geen SVG-variant nodig.** (De legacy-jank-metric 97% is de
      bekend-opgeblazen variant; negeren.)
- [x] **UX-12** — Android-back (hardware-knop én veeggebaar) keert naar de vórige tab.
      **✅ Device 2026-06-26 (moto):** hardware-back loopt Boodschappen→Taken→Thuis (per-tab,
      dump-bevestigd); en met tijdelijk ingeschakelde gesture-nav keert óók de edge-swipe naar de
      vorige tab (`backBehavior="history"`). Nav-modus daarna teruggezet op 3-knops.
- [ ] **INF-9** — `scan-receipt` happy-path (echte foto → Orq) — vereist de Orq-secrets (zie D).

**D. Flip-on (apart van de device-batch; account-/secret-afhankelijk)**
- [ ] **PLT-1** — notify trap 2: secret + `functions deploy notify` + Database Webhook op `tasks`
      + 2-account-test (`docs/notify-setup.md`). **Gate: SEC-5** eerst.
- [ ] **BOO-7** — Orq-deployment + secrets (`docs/orq-receipt-scan.md`).

---

Controleer daarna in het Dashboard (Table editor) dat deze nieuw zijn:
`zones`, `expenses`, `expense_shares`, `plant_species`, `plants`, en de extra
kolommen `tasks.end_time` / `tasks.zone_id` / `tasks.plant_id`. `plant_species`
hoort ~30 rijen te bevatten (de seed uit `0009`).

> Twijfel je of `0003`/`0004` al toegepast zijn? `npx supabase migration list`
> toont local vs. remote. `db push` slaat reeds-toegepaste migraties over.

---

## Stap 2 — RLS-integratietests draaien

De tests lezen URL + anon-key uit je `.env` (de `EXPO_PUBLIC_*`-waarden); alleen
de service-role-key geef je los mee. Eén commando:

```bash
cd /Users/evdniet/code/huishoek/smol-test

SUPABASE_URL="$(grep EXPO_PUBLIC_SUPABASE_URL .env | cut -d= -f2)" \
SUPABASE_ANON_KEY="$(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env | cut -d= -f2)" \
SUPABASE_SERVICE_ROLE_KEY="PLAK_HIER_DE_SERVICE_ROLE_KEY" \
npm test
```

Zonder de drie variabelen skippen de RLS-tests; mét variabelen draaien ze écht.
Verwacht: alle RLS-tests lopen door i.p.v. `skipped`, waaronder de kindtabel-cases
die het grootste risico afdekken (een kindtabel met eigen policies die de
zichtbaarheid van zijn parent moet erven):
- `RLS: household-uitgave + shares zichtbaar voor huisgenoot, niet voor buitenstaander`
- `RLS: subgroep-uitgave alleen voor subgroepleden (...)` (Kosten — `expense_shares`)
- `RLS: dagboekfoto zichtbaar voor huisgenoot, niet voor buitenstaander` (Planten — `plant_photos`)
- `RLS: voltooiing van household-taak zichtbaar voor huisgenoot, niet voor buitenstaander`
- `RLS: voltooiing van custom-taak alleen zichtbaar voor genoemde personen` (`task_completions`, plan 01)

Deze bewijzen dat de RPC's werken én dat elke kindtabel (`expense_shares`,
`plant_photos`, `task_completions`) de zichtbaarheid van zijn parent erft.

> De tests maken tijdelijke testgebruikers aan (`rlstest+<timestamp>@example.com`)
> en ruimen die na afloop op. Gebruik een test-/staging-project, geen productie
> met echte data.

---

## Stap 3 — Snelle handmatige rooktest (optioneel)

Start de app (`npm start`) met twee accounts in één huishouden en loop af:
- **Agenda**: maak een afspraak met datum → verschijnt op de juiste dag; subgroep-filter werkt.
- **Schoonmaak**: "Weekschema opzetten" → zones + terugkerende taken aangemaakt; afvinken rolt door.
- **Kosten**: uitgave splitsen (gelijk/aandeel/exact) → saldo klopt, "Vereffenen" toont de juiste betalingen; een subgroep-uitgave is niet zichtbaar voor een niet-lid.
- **Planten**: plant met soort → verzorgingstaken verschijnen in Vandaag; verzorgingskaart toont de regels.
- **Navigatie**: tabbalk toont 5 items (Vandaag, Taken, Agenda, Boodschappen, Meer); onder **Meer** staan Schoonmaak, Kosten, Planten en Huishouden.
