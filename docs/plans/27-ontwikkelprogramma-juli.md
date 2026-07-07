# Plan 27 — Ontwikkelprogramma komende weken (review 2026-07-06)

> **Wat dit is:** de gevalideerde voorbereiding van de komende ontwikkelweken, op basis van
> een volledige review (code, backlog §6/§7, live-stand DB/edge/eval) + drie gerichte
> verkenningen (lege modules, auth/invites, TML/AI-9/eval-infra). Door Erik gekozen scope
> (2026-07-06): **AI-overal + AI-11 + AI-9 + AI-16r3 · PLT-7/8 + PLT-3 + DOC-1 ·
> AI-kwaliteitsborging + security-staart + ARCH-4 + TML-4/6** (WEN-1 bewust niet).
> Status blijft in §6 leven; dit doc is het *hoe* + de volgorde-rationale.

## Review-conclusies die de volgorde bepalen

1. **Verificatie-schuld eerst ontgrendelen.** ~15 items staan op 🔧 (cap ~10, eigen
   spelregel §6). Eén device-avond (moto) archiveert een dozijn rijen en de-risked alles
   wat daarna komt. Dit is Golf 0 en vraagt Erik + toestel.
2. **QA vóór expansie.** De vervolg-beurt (AI-18) en choice-replies zijn nieuwe
   interactiepatronen zónder golden-cases; de eval-runner is single-turn-only en er is
   geen toon-judge; de Maestro-rooktest dekt nul assistent-flows. Tien nieuwe AI-tools
   uitrollen zonder deze borging = regressies onzichtbaar maken. Golf 1 = de gate verbreden.
3. **Tool-budget is een echte grens.** Nu 11 tools; AI-overal voegt er 10 toe → 21, tegen
   de herbezoek-drempel (guidelines §1: >20–25). Daarom gefaseerd: eerst de 5 read-tools
   (16 totaal), writes per module erna, en bij het kruisen van ~20 expliciet het
   tool-search/deferred-loading-besluit nemen (staat als beslispunt in Golf 2).
4. **Migratienummer-drift.** 0074 is bezet; AI-9 (plan 24 zegt nog "0074") én TML-4/6
   willen allebei het volgende nummer. Toewijzing hier: **TML-4 → 0075, TML-6 → 0076,
   AI-9 → 0077, PLT-3-RPC → 0078, DOC-1 → 0079** (wie eerder/later landt: nummer
   doorschuiven; verifieer live via MCP `list_migrations`, nooit uit dit doc).

## Golven

### Golf 0 — Device-verificatie-batch (met Erik, ~1 avond)
Checklist (VERIFICATIE.md-stijl): AI-16/18 (chart-tik, weekmenu-rooster, choice→reply,
porties-stepper, confirm→vervolg-beurt, "Akkoord met alles"→één beurt, beide thema's),
AI-15-afvinken-HITL, AI-17-beheer-UI, PLT-7 join-e2e (web→app). Elke bevestiging: 🔧→✅→archief.

### Golf 1 — AI-kwaliteitsborging + AI-overal fase A (leestools)

**1a. Eval-volwassenheid (AI-20, nieuw):**
- **Multi-turn-cases**: golden-schema uitbreiden met een `turns`-array (assistant-tool-calls
  + gemockte tool-results + confirm-context); `runCase` bouwt de volledige input i.p.v.
  `[system, user]`; `scoreCase` scoort de láátste beurt. Doel-cases: de vervolg-beurt na
  confirm (reageert kort + logische vervolgstap; verzint niets bij "geen vervolgstap") en
  choice-reply-opvolging ("Gebruik het recept X" → plannen mét recipe_id).
- **NL-toon-judge (LLM-as-judge)**: tweede model-call met gekalibreerde rubric (beknopt,
  warm, je-vorm, geen data-opsomming in lopende tekst); nieuwe `toneScore`-metric in
  summary + baseline + gate. Kalibratie: 10 hand-gelabelde voorbeelden vóór de rubric vastligt.
- **Maestro-assistent-flow** (INF-3-uitbreiding): 06-assistent.yaml — chat openen, vraag
  stellen, kaart verschijnt, voorstel bevestigen, vervolg-beurt verschijnt. Self-cleanend
  (E2E-prefix). Device-gated draaien, maar de flow nu al schrijven.

**1b. AI-overal fase A (AI-19, nieuw) — 5 read-tools via het vocabulaire:**
| Tool | Bron (puur, bestaand) | Gen-UI |
|---|---|---|
| `planten_overzicht` | `plantCare.careCard/waterIntervalDays` + open plant-taken | list/schedule |
| `huisdieren_overzicht` | `petCare.ageLabel/speciesLabel` + laatste gewicht | list |
| `voertuigen_overzicht` | `vehicleCosts.vehicleCostSummary` (TCO) + APK | keyvalue + chart |
| `tijdlijn_recent` | `timeline.orderTimeline/summarizePost` (RLS filtert zichtbaarheid) | list |
| `delen_reserveringen` | `reservations.reservationsByDay` (komende) | schedule |
Elke tool: manifest + brief + pack-test + golden-cases (per tool ≥2) + ratchet-groep.
De RLS-gebonden ctx.db maakt zichtbaarheid gratis correct (geverifieerd: index.ts bouwt
de client met user-JWT).

### Golf 2 — AI-overal fase B (writes) + AI-11 + TML

**2a. Write-tools (HITL, allemaal `risk:'write'`, additief, géén financiële boekingen):**
`planten_toevoegen` (+`buildCareTasks`), `huisdieren_logboek_toevoegen` (CHECK: minstens
één van notitie/gewicht; gewicht in grammen), `voertuigen_onderhoud_loggen` (alleen
`vehicle_log`, geen expense-koppeling), `tijdlijn_plaatsen` (body verplicht, visibility
default `'household'` — assistent verzint nooit subgroup/custom), `delen_reserveren`
(**`hasConflict` verplicht in propose én execute** — de DB dwingt overlap niet af).
Undo-whitelist uitbreiden per insert-tabel. EDITABLE_FIELDS per tool.
**Beslispunt bij ~20 tools:** tool-search/deferred loading vs. accepteren (meta-test
`assistantCoverage` bewaakt de drempel) — expliciet afwegen, niet stil kruisen.

**2b. AI-11 — catalogus-matching + auto-categoriseren:**
(1) `proposeAddGroceries` matcht items tegen `lib/groceryCatalog.searchCatalog` +
`catalog_products` in propose (server-side, deterministisch — geen extra model-call):
treffer → schap/emoji/eenheid mee in het voorstel. (2) Geen treffer → categoriseren met
een goedkoop model (aparte kleine Orq-call, ná execute, async — nooit in de agent-loop;
zelfde discipline als de AI-9-extractor). Eval-gate: golden-cases voor het matchen.

**2c. TML-4 (migratie 0075) + TML-6 (0076):** exact volgens plan 19 —
`timeline_comments` (kind-tabel, erft post-zichtbaarheid, comment-thread op detail) en
het filter-fundament (`lib/timelineFilter.js` DEFAULT-ON + prefs-tabellen à la 0004 +
instellingen-sectie). Beide via MCP `apply_migration` + RLS-suite-scenario's.

### Golf 3 — Frictieloos aan boord + vindbaarheid

**3a. PLT-8 — OTP-code-login (native-first):** `signInWithOtp({ email, shouldCreateUser })`
+ 6-cijferige code-invoer (géén magic-link-URL-parsing: native `detectSessionInUrl` staat
uit en deep-links dekken alleen `/join` — gevalideerd). Raakt: `lib/auth.js` (+`signInWithOtp`/
`verifyOtp`), `app/(auth)/welcome.js` (code-flow als primaire pad, wachtwoord blijft
bestaan), `app/join/[token].js` (goLogin → OTP-variant). **Erik-actie:** Supabase-dashboard
(email-OTP aan + template + redirect-allowlist). Display-name na eerste login afvragen
(OTP-signup heeft geen naamveld).
**3b. PLT-7 afronden:** echte store-links op het 🎉-scherm (of een nette
"binnenkort"-staat), join-e2e in Golf 0 geverifieerd.
**3c. PLT-3 — globaal zoeken:** server-side RPC `global_search(q)` (SECURITY INVOKER —
RLS scopet per tabel) over tasks/groceries/recipes/expenses/plants/pets/vehicles/
timeline_posts met per-bron een compacte hit (type, titel, route); pure ranker
`lib/searchRank.js` (prefix > woordgrens > substring, recent wint); zoekscherm via "Meer"
+ zoekveld op Thuis. Migratie 0078. De assistent blijft de semantische zusterroute.

### Golf 4 — Geheugen + gen-UI ronde 3

**4a. AI-9 geheugen v1 (migratie 0077):** volgens plan 24 ronde H — `assistant_memories`
(pgvector + 'dutch' tsvector, user/household-scope-RLS), hybrid-RRF-RPC met over-fetch,
`assistent_onthouden`-tool (HITL) + async extractor als aparte Orq-deployment (dedupe op
semantische gelijkenis), memory zichtbaar in de chat + beheer in Instellingen
(inzien/verwijderen/uitzetten — guidelines §5). Eval: golden-cases met geïnjecteerd geheugen.
**4b. AI-16 ronde 3 (+3 node-types max):** `image` (storage-paths, alleen eigen bucket),
`progress`, lijn-variant op `chart` (trend over maanden); choice-node breder (AI-11-matches,
ledenkeuze bij taak-toewijzing). Zelfde regels: constructors in render.js, roundtrip-test,
text-fallback.

### Doorlopend / dedicated

- **Security-staart:** REV-2 P8/P9-opvolging; SEC-6 (service-role-key uit app-`.env`,
  shell-injectie + rotatie per SECURITY.md); SEC-7 L2 (audit-hercheck bij SDK-bump).
- **ARCH-4 (dedicated sessie, gedragsneutraal):** `lib/i18n.js` en `lib/ui.js` per domein
  splitsen; ratchet-groepen mee verhuizen; geen gedragswijziging (codeEquivalence-check).
- **DOC-1 — documenten- & garantiekluis (module-golf, migratie 0079):** module-descriptor
  (`modules.js` + `enable_module_rls('documents')`), tabel `documents` (titel, soort,
  foto/bestand-path, `expires_on`, koppelbaar aan voertuig/apparaat), Storage-bucket à la
  plant-foto's, garantie-herinnering via de bestaande reminder-laag (taak met deadline),
  lijst+detail+editor via `useEntityForm`. Direct een assistent-read-tool meeontwerpen
  (`documenten_zoeken`) — nieuwe modules zijn vanaf nu AI-inclusief.

## Definition of done (per golf, ongewijzigd CLAUDE.md)
Ratchet groen · unit-test per nieuwe export · typecheck · volledige suite · docs in
dezelfde PR · migraties via MCP + advisor-check + RLS-scenario · tool/prompt-wijzigingen
door de eval-gate · edge-deploy met byte-verificatie (werkwijze van v18).
