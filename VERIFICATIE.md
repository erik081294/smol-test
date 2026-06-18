# Verificatie-runbook — Fase 1 modules tegen live Supabase

> **Status (bijgewerkt 2026-06-17).** Het meeste hieronder is **al gedaan**: de
> migraties `0004`–`0011` zijn naar het hosted project gepusht (DB staat op `0011`)
> en de RLS-integratietests zijn groen tegen de live database gedraaid — zie PR #3.
> **Resteert alleen:** de handmatige rooktest met 2 accounts in één huishouden
> (Stap 3 onderaan). De stappen 1–2 blijven staan als naslag/herhaalrecept (bijv.
> wanneer er een nieuwe migratie bijkomt).
>
> **Draaien vanuit Claude Code on the web?** De secrets zitten niet in de remote
> container (geen `.env`, env-vars leeg) en de CLI is daar niet ingelogd. Om het tóch
> remote te draaien: zet `SUPABASE_ACCESS_TOKEN` (vervangt `supabase login`),
> `SUPABASE_DB_PASSWORD` en `SUPABASE_SERVICE_ROLE_KEY` + de twee `EXPO_PUBLIC_*`
> als **environment variables** in de environment-config, en zet network access op
> **Custom** met `api.supabase.com`, `*.supabase.co` en `*.pooler.supabase.com` op de
> allowlist (Supabase staat niet in de default-allowlist). Anders falen login/push/tests
> op netwerkniveau. Gebruik een test-/staging-project, geen productie.

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

Zonder de drie variabelen skippen de RLS-tests (zoals nu); mét variabelen draaien
ze écht. Verwacht: de **5 RLS-tests** lopen door i.p.v. `skipped`, waaronder de
twee nieuwe voor de Kosten-module:
- `RLS: household-uitgave + shares zichtbaar voor huisgenoot, niet voor buitenstaander`
- `RLS: subgroep-uitgave alleen voor subgroepleden (...)`

Deze bewijzen dat de `create_expense` RPC werkt én dat `expense_shares` de
zichtbaarheid van zijn parent-`expense` erft (het grootste risico van de nieuwe
modules: een kindtabel met eigen policies).

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
