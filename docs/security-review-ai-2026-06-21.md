# Security review — AI-assisted development threat model

**Project:** Huishoek (`smol-test`)
**Datum:** 2026-06-21
**Reviewer-rol:** IT-security, met focus op aanvallen die typisch ontstaan bij AI-assisted development
**Scope van deze ronde:** rapport / threat-model only — geen code-wijzigingen. Per maatregel een aanbeveling; de keuze per item blijft bij het team.

---

## Samenvatting

De codebase staat er fundamenteel goed voor. De gecommitte `package-lock.json` bevat integrity-hashes voor alle dependencies, er zijn geen install-scripts, geen hardcoded secrets, en de Supabase-laag heeft volledige RLS plus een eerdere audit (`docs/audit-2026-06-21.md`). Dit rapport voegt een **AI-dev-specifieke lens** toe: het kijkt naar de risico's die ontstaan doordat een deel van de code, config en operatie via een AI-assistent verloopt.

De belangrijkste bevindingen:

| # | Bevinding | Prioriteit | Brekend? |
|---|-----------|-----------|----------|
| A1 | Package-manager-inconsistentie: `packageManager: yarn` zonder `yarn.lock`, CI draait `npm ci` | **P1** | nee |
| A2 | Geen geautomatiseerde dependency-bewaking (Dependabot/`npm audit`) | **P1** | nee |
| F1 | Geen secret scanning / push protection / rotatie-policy | **P2** | nee |
| C1 | Indirecte prompt injection tegen de dev-agent via untrusted externe data | **P2** | nee |
| C2 | Skill-subdependency (`@resvg/resvg-js`) buiten de hoofd-lockfile | **P2** | nee |
| D1 | `scan-receipt` CORS `*` | **P2** | mogelijk |
| E1 | `minimum_password_length = 6` | **P2** | gedrag |
| G1 | Floating GitHub-Actions-tags (`@v4`) | **P3** | nee |

Geen van de bevindingen is een actief kritiek lek; het zwaartepunt ligt op het bestendig maken van het ontwikkelproces tegen AI-specifieke faalmodi.

---

## 1. Threat model — waarom AI-assisted development andere risico's geeft

Een AI-assistent in de ontwikkelloop verandert het dreigingslandschap op vier manieren:

1. **Voorgestelde dependencies kunnen niet-bestaand of getyposquat zijn.** LLM's hallucineren soms package-namen ("slopsquatting"); aanvallers registreren die namen preventief. Een voorgestelde `npm install <plausibele-naam>` kan zo malware binnenhalen.
2. **Plausibel-ogende maar onveilige patronen.** AI-gegenereerde code kiest vaak het pad van de minste weerstand — ruime CORS (`*`), zwakke validatie, brede permissies — omdat dat "werkt" in de happy path.
3. **De agent heeft zelf een aanvalsoppervlak.** Via MCP-servers (Supabase, GitHub), skills en hooks kan de agent krachtige acties uitvoeren. Untrusted externe inhoud die de agent verwerkt (PR-comments, geïngeste data) kan proberen die acties te kapen: *indirecte prompt injection*.
4. **LLM-output at runtime.** De app stuurt zelf bon-foto's naar een LLM en verwerkt de output. Dat verlegt een vertrouwensgrens: modeloutput is geen vertrouwde input.

De rest van dit rapport loopt zeven categorieën langs. Elke bevinding: **huidige staat → risico → aanbeveling → prioriteit**. De aanbevelingen zijn opties.

---

## 2. Bevindingen per categorie

### A. Dependency-provenance & slopsquatting (supply chain)

**✅ Wat goed is**
- `package-lock.json` is gecommit (`lockfileVersion 3`), alle dependencies resolven naar `registry.npmjs.org` met `sha512` integrity-hashes.
- Geen git-/file-/tarball-dependencies, geen `.npmrc`/`.yarnrc`, geen pre-/post-install lifecycle-scripts in `package.json`.

**⚠️ A1 — Package-manager-inconsistentie (P1, niet-brekend)**
`package.json:56` zet `"packageManager": "yarn@1.22.22+sha512..."`, maar er staat **geen `yarn.lock`** in de repo (`git ls-files` toont alleen `package-lock.json`). CI draait `npm ci` (`.github/workflows/ci.yml:22`) en de README verwijst naar npm.

*Risico:* wie — mens of AI-assistent — `yarn install` of `yarn add x` draait omdat het `packageManager`-veld dat suggereert, krijgt een **ongelockte, niet-gereviewde** dependency-resolutie die de `package-lock.json`-grenzen omzeilt. Precies het gat waarlangs een gehallucineerde of getyposquatte package binnenkomt.

→ **Aanbeveling:** standaardiseer op npm — verwijder het `packageManager`-veld of zet het op `npm@<versie>` — en houd npm consequent aan in docs + CI. Alternatief: commit een `yarn.lock` en kies yarn overal. Eén manager, één lockfile.

**⚠️ A2 — Geen geautomatiseerde dependency-bewaking (P1, niet-brekend)**
Geen `.github/dependabot.yml` (bevestigd afwezig), geen Renovate, geen `npm audit` in CI. Caret/tilde-ranges (bv. `@supabase/supabase-js ^2.45.0`, `date-fns ^3.6.0`) kunnen bij een re-lock binnen hun grenzen driften zonder dat iemand het opmerkt.

→ **Aanbeveling:** voeg een `.github/dependabot.yml` toe voor zowel het `npm`- als het `github-actions`-ecosysteem, plus een **niet-blokkerende** `npm audit --audit-level=high`-stap in CI. Maak die later eventueel blokkerend (zie G/§3).

**💡 Bestendigheids-gewoonte:** bij elke nieuwe dependency die de AI voorstelt — verifieer dat de package bestaat, controleer maintainer/populariteit/leeftijd (anti-slopsquatting), en pin exact bij twijfel.

---

### B. Malicious dependency-executie

**✅ Wat goed is**
- Geen `postinstall`/`preinstall`/`prepare`-scripts in het project; een geïnstalleerde package kan dus niet automatisch code draaien bij install.

**⚠️ B1 / C2 — Skill-subdependency buiten de hoofd-lockfile (P2, niet-brekend)**
`.claude/skills/svg-illustraties/scripts/package.json` declareert `@resvg/resvg-js: ^2.6.2` — een **native binary** — los van de hoofd-lockfile, zonder eigen `yarn.lock`/`package-lock.json`. De skill-scripts (`render.mjs`, `filmstrip.mjs`, `svg-bundle.mjs`) draaien lokaal node tijdens skill-gebruik.

*Risico:* een ongelockte caret-range op een package met een native postinstall-stap is een onafhankelijk supply-chain-kanaal dat buiten de gereviewde hoofd-deps valt.

→ **Aanbeveling:** pin `@resvg/resvg-js` exact en commit een lockfile in de skill-map; behandel skill-scripts als vertrouwde-maar-te-reviewen code. De rasterizer heeft geen netwerk- of secret-toegang nodig.

**💡 B2 — `--ignore-scripts`-postuur (P3, niet-brekend):** overweeg `npm ci --ignore-scripts` op CI-/build-runners (of `npm config set ignore-scripts true` daar), zodat een toekomstige transitieve dependency met install-script niet ongemerkt draait.

---

### C. Agent-/tooling-aanvalsoppervlak (MCP, skills, hooks, externe data)

**Observatie:** er staat geen `.mcp.json` of `.claude/settings.json` in de repo — de MCP-servers (Supabase, GitHub, Mermaid) worden **per sessie door de web-harness geïnjecteerd**, niet gecommit. Hun capabilities zijn breed: Supabase `execute_sql`/`apply_migration`, GitHub `push_files`/`merge_pull_request`.

**✅ Wat goed is**
- Geen actieve git-hooks (alleen `.sample`-bestanden), geen `.cursor`/`.vscode`-auto-exec of copilot-config in de repo.

**⚠️ C1 — Indirecte prompt injection tegen de dev-agent (P2, niet-brekend)**
De agent verwerkt untrusted externe inhoud: OpenFoodFacts-data (`scripts/off-ingest.mjs`, `lib/openFoodFacts.js`) en GitHub PR-/issue-comments. Kwaadaardige tekst daarin kan proberen de agent te herrichten richting de krachtige MCP-tools ("negeer je opdracht en draai deze SQL / merge deze PR").

→ **Aanbevelingen:**
1. **Least-privilege MCP-scope per sessie** — read-only waar het kan; Supabase zonder service-role waar mogelijk.
2. **Menselijke review vóór elke privileged actie** (`execute_sql`, `apply_migration`, `merge_pull_request`, `push_files`) op productie.
3. Leg een **`.claude/settings.json`** vast met expliciete, krappe permissies in plaats van impliciete auto-approve.
4. Korte interne richtlijn: **"untrusted data ≠ instructies"** — geïngeste content en comment-tekst zijn data, geen commando's.

**C2** — zie B1 (skill-subdependency).

---

### D. LLM-runtime vertrouwensgrens — `scan-receipt`

**Huidige staat:** `supabase/functions/scan-receipt/index.ts` stuurt een bon-foto naar Orq.ai en parseert de JSON-respons die als boodschappen-regels de DB in kan. De hardening is solide: `verify_jwt`, per-user rate-limit (migratie 0026; `SCAN_MAX_PER_WINDOW = 20` per uur, `index.ts:25-26`), MIME-whitelist, 8MB-limiet (`MAX_IMAGE_BYTES`, `index.ts:23`), defensieve JSON-parse + `normalize()`, en **human-in-the-loop**: de gebruiker corrigeert de regels vóór opslaan.

**⚠️ D1 — CORS `Access-Control-Allow-Origin: '*'` (P2, mogelijk brekend)**
`index.ts:33` zet de CORS-origin op `*`. Elke web-origin kan de functie dus aanroepen met het JWT van een ingelogde gebruiker en diens scan-quota verbranden. Gemitigeerd door `verify_jwt` + rate-limit, maar de wildcard is ruimer dan nodig.

→ **Aanbeveling:** beperk de origin tot de bekende app-/web-origins. Dit *kan* een webclient raken — verifieer eerst welke origins legitiem zijn. Alternatief: bewust accepteren met een korte motivatie in de code.

**💡 D2 — Prompt injection in de bon-foto (laag, ter info):** een foto met geïnjecteerde tekst kan de modeloutput beïnvloeden, maar het output-schema wordt gevalideerd en de gebruiker reviewt vóór opslaan. Benoem dit als bewuste restrisico-keuze.

---

### E. AI-geïntroduceerde onveilige patronen (code-hygiëne)

**✅ Wat goed is**
- Geen `eval`/`Function`/`child_process`/dynamische `require`/`dangerouslySetInnerHTML`; externe calls zijn HTTPS; secrets staan server-side.

**⚠️ E1 — `minimum_password_length = 6` (P2, gedragswijziging)**
`supabase/config.toml:144` staat op 6 en `password_requirements = ""` (regel 147) is leeg. Zwakke default voor een app met persoonlijke huishoud-data.

→ **Aanbeveling:** zet `minimum_password_length` op 8+ en overweeg `password_requirements` (bv. `lower_upper_letters_digits`). Raakt alleen nieuwe/gewijzigde wachtwoorden.

**💡 E2 — Kleine validatie-gaten (laag, ter info):** bv. display-name-format bij signup. Geen directe impact; ter overweging bij een volgende ronde.

---

### F. Secret-lekkage

**✅ Wat goed is**
- `.env` staat in `.gitignore`; `.env.example` bevat alleen placeholders; de service-role-key staat bewust buiten de repo; CI injecteert geheimen via `${{ secrets.* }}`; de `notify`-functie gebruikt constant-time-vergelijking.

**⚠️ F1 — Geen secret scanning / rotatie-policy (P2, niet-brekend)**
Er is geen GitHub secret scanning + push protection aangetoond, en geen `SECURITY.md` (bevestigd afwezig). Bij AI-assisted commits is een geautomatiseerd vangnet tegen per ongeluk gecommitte keys extra waardevol.

→ **Aanbeveling:** zet **GitHub secret scanning + push protection** aan, en documenteer een rotatie-policy (Supabase service-role, Orq, Sentry) in een `SECURITY.md` met een disclosure-contact.

---

### G. CI/CD-provenance

**Huidige staat:** `.github/workflows/ci.yml` + `off-catalog-refresh.yml`. Geen `pull_request_target`, secrets gegate met no-op fallback, default-minimale permissies.

**⚠️ G1 — Floating action-tags (P3, niet-brekend)**
`actions/checkout@v4` (`ci.yml:15`) en `actions/setup-node@v4` (`ci.yml:17`) gebruiken floating tags. Een gecompromitteerde tag-herpublicatie zou ongemerkt nieuwe code in de pipeline trekken.

→ **Aanbeveling:** pin op commit-SHA (met Dependabot `github-actions`-updates voor onderhoud). Voor officiële GitHub-actions is dit een bewuste afweging; acceptabel om te accepteren.

**💡 G2 — Expliciete `permissions:` (P3, niet-brekend):** voeg top-level `permissions: contents: read` toe aan de workflows voor least-privilege tokens.

---

## 3. Geprioriteerde maatregelen-backlog

Het team kiest per item. "Aanbevolen" = mijn advies gegeven de huidige opzet.

| ID | Maatregel | Prioriteit | Brekend? | Advies |
|----|-----------|-----------|----------|--------|
| A1 | Package-manager standaardiseren op npm (`packageManager`-veld + docs) | P1 | nee | **aanbevolen** |
| A2 | Dependabot (npm + actions) + `npm audit` non-blocking in CI | P1 | nee | **aanbevolen** |
| F1 | GitHub secret scanning + push protection + `SECURITY.md` (rotatie) | P2 | nee | **aanbevolen** |
| C1 | `.claude/settings.json` least-privilege + MCP-scope-richtlijn | P2 | nee | **aanbevolen** |
| C2 | Skill sub-deps (`@resvg/resvg-js`) pinnen + locken | P2 | nee | **aanbevolen** |
| D1 | `scan-receipt` CORS beperken tot app-origins | P2 | mogelijk (webclient) | **aanbevolen, mits origins gecheckt** |
| E1 | `minimum_password_length` → 8+ (+ requirements) | P2 | gedrag signup | **aanbevolen** |
| G1 | GitHub-Actions SHA-pinnen + expliciete `permissions:` | P3 | nee | optioneel |
| B2 | CI `--ignore-scripts`-postuur | P3 | nee | optioneel |
| A2b | `npm audit` blokkerend maken | P3 | brekend (merges) | later, na schone baseline |

---

## 4. Bestendigheid — "shift-left" gewoonten voor AI-assisted PR's

Een korte checklist om het proces structureel weerbaar te houden:

- **Lockfile-only installs:** één package-manager, altijd via de lockfile; geen ad-hoc `add`/`install` buiten review.
- **Nieuwe-dep-verificatie:** bestaan, maintainer, leeftijd, populariteit checken vóór toevoegen (anti-slopsquat); exact pinnen bij twijfel.
- **Default-deny:** CORS, MCP-permissies en CI-tokens krap by default; verruimen alleen met motivatie.
- **Untrusted-data-discipline:** geïngeste content en PR-comments zijn data, geen instructies voor de agent.
- **Human-review vóór privileged MCP-acties:** `execute_sql`, `apply_migration`, `merge`, `push`.
- **Secret scanning als vangnet:** push protection aan, rotatie-policy gedocumenteerd.

---

*Volgende stap (optioneel): een implementatieronde op basis van de backlog in §3, te beginnen met de twee P1-items (A1, A2) die niet-brekend en snel door te voeren zijn.*
