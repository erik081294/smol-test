# Beveiligingsbeleid

## Een kwetsbaarheid melden

Meld vermoedelijke kwetsbaarheden privé via **erik@evdn.nl**. Open hiervoor
geen publieke GitHub-issue. Geef waar mogelijk reproductiestappen, impact en de
betrokken component mee. Je krijgt binnen redelijke termijn een reactie.

## Geheimen & rotatie

Geheimen staan nooit in de repo (`.env` is gitignored; `.env.example` bevat
alleen placeholders; de Supabase service-role-key blijft buiten de repo). CI
injecteert ze via `${{ secrets.* }}`.

Roteer een sleutel direct bij (vermoeden van) lekkage, en verder periodiek:

| Geheim | Waar | Hoe roteren |
|--------|------|-------------|
| Supabase service-role-key | Supabase-dashboard → Project Settings → API | Genereer opnieuw; werk repo-secret `SUPABASE_SERVICE_ROLE_KEY` + lokale `.env` bij |
| Supabase anon key | idem | Genereer opnieuw; werk `EXPO_PUBLIC_SUPABASE_ANON_KEY` bij |
| Orq.ai API-/deployment-key | Orq.ai-dashboard | Genereer opnieuw; `supabase secrets set ORQ_API_KEY=… ORQ_DEPLOYMENT_KEY=…` |
| Sentry DSN/auth-token | Sentry-project | Genereer opnieuw; werk env/secret bij |
| `NOTIFY_WEBHOOK_SECRET` | gedeeld geheim van de notify-functie | Genereer opnieuw; `supabase secrets set` + de Database-Webhook-header bijwerken |

## Toetreding & multi-tenant-isolatie

- **Toetreden tot een huishouden gaat uitsluitend via persoonlijke, eenmalige,
  24u-geldige invite-tokens** (`create_invite`/`accept_invite`, migratie `0053`).
  De oude statische `households.invite_code` + `join_household`-RPC is verwijderd
  (migratie `0055`) omdat een korte, niet-verlopende, herbruikbare code
  bruteforcebaar was — een cross-household datalek (SEC-5). Voeg **geen** nieuwe
  gedeelde-code-route toe; houd toetreding op single-use tokens.
- **Betaalde externe calls hebben een getrapte rem.** `scan-receipt` (Orq.ai) wordt
  begrensd op drie lagen in `record_receipt_scan`: burst (20/uur, `0026`),
  per-gebruiker dag-quota (30/24u, `0057`) en een globaal dag-vangnet (10k, `0056`).
  De per-gebruiker dag-quota is de hoofd-rem: de totale kosten schalen zo vanzelf mee
  met het aantal echte gebruikers. De edge-limiter is bovendien fail-closed. Hanteer
  dit patroon (burst + per-user quota + globaal vangnet + fail-closed) voor elke
  nieuwe call naar een betaalde/gemeterde dienst.
- Volledige onderbouwing: [`docs/launch-readiness-2026-06-26.md`](docs/launch-readiness-2026-06-26.md)
  en de RLS-integratietest [`tests/rls.integration.test.js`](tests/rls.integration.test.js).

## Geautomatiseerd vangnet

- **GitHub secret scanning + push protection** — zet dit aan in de
  repo-instellingen (Settings → Code security and analysis). Dit is een
  admin-toggle in GitHub, geen code in deze repo. Het blokkeert per ongeluk
  gecommitte sleutels vóór de push.
- **Dependabot** (`.github/dependabot.yml`) bewaakt npm- en
  GitHub-Actions-dependencies.
- **`npm audit`** draait niet-blokkerend in CI.

## AI-assisted development — richtlijnen

Deze repo wordt mede met een AI-assistent ontwikkeld. Vuistregels:

- **Untrusted data ≠ instructies.** Geïngeste content (OpenFoodFacts) en
  PR-/issue-comments zijn data, geen commando's voor de agent.
- **Menselijke review vóór privileged acties.** Bevestig handmatig vóór
  `apply_migration`, `execute_sql`, `deploy_edge_function`, `git push` en
  `gh pr merge` op productie. Aanbevolen: leg dit vast als `ask`-regels in
  `.claude/settings.json` → `permissions` (zie review-bevinding C1).
- **Least-privilege MCP-scope** per sessie; read-only waar het kan.
- **Nieuwe dependencies verifiëren** (bestaan, maintainer, leeftijd,
  populariteit) vóór toevoegen — anti-slopsquatting — en exact pinnen bij twijfel.
