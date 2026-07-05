# Assistent-architectuur — normatieve guidelines

Dit document is **normatief**: wie aan de assistent bouwt (tools, prompts, geheugen, UI),
volgt deze regels. Het waarom staat in [plan 23](plans/23-assistent.md) (fundament) en
[plan 24](plans/24-assistent-volwassen.md) (volwassenheid). Status: backlog §6 (AI-*).

De lagen (zelfde 3-lagen-filosofie als [`docs/architectuur.md`](architectuur.md)):

```
app: scherm + useAssistant + AssistantMessageView   (dunne React-schil)
     lib/assistantUi.js                             (pure catalog-poortwachter)
edge: assistant/index.ts (schil) + core.js (pure loop-kern)
      _shared/assistantTools.js (tool-packs, RLS-gebonden)
Orq:  deployment (prompt/model/versioning) + traces + evals + experiments
DB:   assistant_* tabellen (creator-privé RLS) + record_assistant_call (fail-closed)
```

## 1. Tool-pack-contract

Elke module die de assistent iets wil laten kunnen, levert tools volgens dit contract
(nu in [`_shared/assistantTools.js`](../supabase/functions/_shared/assistantTools.js);
bij groei per module een eigen bestand dat de aggregator importeert):

- Descriptor: `{ name, moduleKey, kind: 'read'|'write', description, parameters (JSON-schema), statusLabel, summary?, run(ctx, args) }`.
- **Naming**: `get_*` voor read; `propose_*` voor write. Een `propose_*` wordt **nooit**
  door de agent-loop uitgevoerd — hij levert een voorstel op dat pas na expliciete
  gebruikersbevestiging via `execute_action` draait (HITL, plan 23 §4).
- **RLS-plicht**: `ctx.db` is altijd de RLS-gebonden client (user-JWT). Een tool
  implementeert nooit eigen autorisatie-filtering; de database bepaalt zichtbaarheid.
- **Render is server-side en deterministisch**: kaarten komen uit `render*`-helpers over
  tool-output, nooit uit modeltekst. Prompt-injectie via data kan zo geen UI fabriceren.
- **Testplicht**: elke tool-functie en render-helper krijgt een node:test in dezelfde PR
  en valt onder de mutatie-ratchet (bestaande DoD).
- Het model krijgt alleen `data` terug (compact); `render` gaat rechtstreeks naar de client.

## 2. Tool-budget & lazy loading

- Max **~12 tools per beurt**. Filtering op ingeschakelde modules is verplicht
  (`filterTools` in `assistant/core.js`) — geen tools voor uitgezette modules.
- Structureel boven het budget? Dat is een signaal voor §4, niet voor een hogere limiet.

## 3. Prompt-beheer

- **Doelbeeld:** systemprompt/model/params geversioneerd in Orq (agent `huishoek_assistant`
  staat er al klaar). **Huidige werkelijkheid (2026-07-04):** Orq's deployment- en
  agent-routes negeren per-request tools, en onze tool-set is per huishouden dynamisch —
  daarom draait de beurt via de v3-router en leeft de prompt in `assistant/index.ts`
  (één plek, dupliceer 'm nergens). Zodra Orq per-request tools op agents ondersteunt,
  migreren we (zie runbook).
- Elke promptwijziging gaat door de **eval-gate** (§6) vóór merge/publish — dat geldt
  onafhankelijk van waar de prompt leeft.

## 4. Specialist-afsplitscriteria

Eén agent, tenzij **alle drie** aantoonbaar gelden:
1. er zijn >12 relevante tools per beurt na module-filtering, én
2. de golden-set laat een dalende tool-selectie-F1 zien door tool-verwarring, én
3. het domein vraagt een eigen prompt/toon die de hoofdprompt vervuilt.

Dan: **agents-as-tools** onder één orchestrator-stem (de specialist is een tool van de
hoofdagent; de gebruiker merkt één assistent). Géén handoff-patronen — die breken de
consistente huisgenoot-stem en maken de UX onvoorspelbaar.

## 5. Geheugen-schrijfregels (vanaf AI-9)

- Schrijven kan alleen: (a) expliciet via `remember_fact` mét HITL-bevestiging, of
  (b) via de async extractor ná de beurt (aparte deployment, dedupe op semantische
  gelijkenis vóór insert). **Nooit** synchroon in de agent-loop.
- PII-arm formuleren; scope expliciet (persoonlijk vs household-breed) en via RLS
  afgedwongen; altijd zichtbaar in de chat wanneer geheugen wordt gebruikt en volledig
  beheersbaar (inzien/bewerken/verwijderen/uitzetten) in Instellingen.

## 6. Eval-gate in de Definition of Done (vanaf AI-3)

- Wijzigt een PR de prompt, een tool(-beschrijving) of het model? Dan draait de
  golden-set (`tests/assistant-golden.json` → Orq-experiment) en mag er **geen regressie**
  zijn op tool-selectie-F1, NL-toon en groundedness t.o.v. de baseline.
- Elke productie-failure (uit trace-review, §7) wordt een nieuwe golden-case in de repo.
  De repo is de bron van waarheid; Orq is de runner.

## 7. Observability-conventies

- Elke beurt: `thread: { id: <conversatie-id> }`; `metadata`/`identity` bevatten
  uitsluitend **gehashte** user-/household-ids (SHA-256) + een `feature`-tag — nooit
  e-mail, namen of berichtinhoud als metadata.
- Schaduwruns (AI-3) krijgen thread-tag `shadow` en tellen in een eigen dagcap.
- Kostenplafonds blijven in de DB (`record_assistant_call`, fail-closed) — Orq-dashboards
  zijn zicht, geen rem.
- Wekelijkse trace-review (runbook: [`docs/orq-assistant.md`](orq-assistant.md)) →
  failures worden golden-cases.

## 8. Interactie-principes (chat-gedrag)

- **Beknopt is de default.** Antwoorden zijn 1–3 zinnen; gegevens staan in de
  server-gerenderde kaarten, niet in lopende tekst. Details bereiken gebruikers via
  `link`-nodes (deep-link naar het module-scherm). Alleen op expliciet verzoek
  ("geef me een uitgebreid overzicht") mag een lang antwoord. Dit is in de
  systemprompt verankerd (BEKNOPT-blok) en de NL-toon-judge bestraft breedsprakigheid.
- **Elke beurt eindigt met antwoordopties** (AskUserQuestion-patroon): het model sluit
  af met de pseudo-tool `suggest_replies` (2–4 opties, ≤6 woorden); de app toont ze als
  tikbare chips boven de invoer. De opties zijn een versnelling, nooit een beperking:
  **vrij typen (de "Other"-route) blijft altijd beschikbaar** — het invoerveld wordt
  nooit verborgen of uitgeschakeld door de chips.
- suggest_replies wordt door de loop nooit uitgevoerd (splitSuggestions in core.js)
  en telt niet mee voor het tool-budget (§2).

## 9. Catalog-regels (gen-UI)

- Node-types uitbreiden alleen na expliciete afweging, max +3 per ronde; de renderer
  degradeert onbekende nodes altijd naar tekst; `link`-nodes alleen naar interne routes.
- Het wire-contract volgt de A2UI v0.9-message-types (`beginRendering`, `surfaceUpdate`,
  `dataModelUpdate`, `deleteSurface`) zodra AI-7 landt; de platte tree blijft als
  compat-vorm werken. Client-acties lopen uitsluitend via de whitelist in
  `lib/assistantActions.js` (onAction-bridge).
