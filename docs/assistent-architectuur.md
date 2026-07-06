# Assistent-architectuur — normatieve guidelines

Dit document is **normatief**: wie aan de assistent bouwt (tools, prompts, geheugen, UI),
volgt deze regels. Het waarom staat in [plan 23](plans/23-assistent.md) (fundament) en
[plan 24](plans/24-assistent-volwassen.md) (volwassenheid). Status: backlog §6 (AI-*).

De lagen (zelfde 3-lagen-filosofie als [`docs/architectuur.md`](architectuur.md)):

```
app: scherm + useAssistant + AssistantMessageView   (dunne React-schil)
     lib/assistantUi.js (pure catalog-poortwachter) + lib/assistantActions.js (onAction-bridge)
edge: assistant/index.ts (schil) + core.js (pure loop-kern) + actions.js (pure HITL-statusmachine)
      _shared/tools/<moduleKey>.js (skill-file per module) + tools/index.js (aggregator)
Orq:  deployment (prompt/model/versioning) + traces + evals + experiments
DB:   assistant_* tabellen (creator-privé RLS) + record_assistant_call (fail-closed)
```

## 1. Tool-pack-contract (skill-file per module)

Elke module levert zijn eigen **skill-file** `_shared/tools/<moduleKey>.js`
(LangChain-toolkit-patroon); de aggregator [`_shared/tools/index.js`](../supabase/functions/_shared/tools/index.js)
flatten't, checkt op dubbele namen en sorteert deterministisch op naam
(cache-hygiëne: tool-definities staan vooraan in de prompt — de set moet binnen
een gesprek byte-stabiel zijn). Het contract wordt afgedwongen door de
contract-metatest [`tests/assistantToolPacks.test.js`](../tests/assistantToolPacks.test.js) —
afwijken faalt in CI, niet pas in productie:

- Descriptor: `{ name, moduleKey, kind: 'read'|'write', description, parameters
  (JSON-schema, overal additionalProperties:false), statusLabel }` + voor read
  `run(ctx, args)`, voor write `propose(args, env)` + `execute(ctx, args)` en de
  MCP-annotaties `destructive`/`idempotent` (risico-vocabulaire; het HITL-beleid
  leest die declaratief).
- **Naming**: `<moduleKey>_<onderwerp>` (bv. `taken_open`, `boodschappen_toevoegen`) —
  Anthropic-namespacing per module; maakt latere tool-search gratis effectief.
  Empirisch bevestigd (2026-07-05): rename van `get_*` naar dit schema → tool-F1
  96,4 → 98,3 op de golden-set.
- **`description` = triggerconditie voorop** (Sonnet-5-afstelling, 2026-07-05). Het
  productiemodel `eu.claude-sonnet-5` volgt letterlijker en onder-triggert tools zodra
  er een systemprompt staat (hoog-precisie/laag-recall). Schrijf de description daarom
  als leidende trigger — *"Roep dit aan wanneer de gebruiker …"* — niet als bijzin
  achteraf, en benoem bij overlappende tools expliciet wanneer je 'm níét gebruikt
  (bv. boodschappen vs. voorraad). Anthropic meet hier meetbare lift op Sonnet 5 /
  Opus 4.8; ditzelfde patroon staat als tool-gebruik-nudge in de systemprompt.
- **HITL: de tool-call ís het voorstel** (industry-convergentie: OpenAI
  `needsApproval` / Vercel AI SDK / LangGraph `interrupt` / Claude Code
  permissions). De harness (index.ts) onderschept elke `kind:'write'`-call:
  `propose` (puur!) valideert en normaliseert de args tot een voorstel, dat als
  `role='action'`-rij wordt opgeslagen (RLS creator-privé, TTL 1u). De gebruiker
  beslist op de bevestigingskaart (multi-edit: per item aan/uitvinkbaar);
  `execute` draait daarna uitsluitend de **opgeslagen** args (de client stuurt
  alleen voorstel-ID + besluit + item-indexen, nooit args). Géén aparte
  execute-tool die het model kan hallucineren, géén confirmed-flag die het
  model zelf kan zetten. Statusmachine (single-shot claim, undo via bewaarde
  insert-ids): [`assistant/actions.js`](../supabase/functions/assistant/actions.js);
  client-bridge: [`lib/assistantActions.js`](../lib/assistantActions.js).
- **Multi-edit-contract**: write-args dragen de batch onder `items[]` (verplicht);
  `propose` houdt de weergaveteksten en `args.items` 1-op-1 uitgelijnd — de
  aan/uitvink-selectie op de kaart zijn indexen in die array.
- **Module-brief (AI-10)**: elke skill-file exporteert `<MODULE>_BRIEF`
  `{ moduleKey, label, brief }` — één regel per actieve module in de
  systemprompt-snapshot (de goedkoopste altijd-in-context-laag; brief 20–140
  tekens, alleen voor modules mét tools — beide contract-getest én exact
  vastgepind in de pack-test).
- **Mens↔AI-overdracht (AI-10)**: `decision:'edit'` is de enige route waarin de
  client args stuurt — een expliciete, geauthenticeerde bewerking door de
  eigenaar van het voorstel, hervalideerd via dezelfde pure `propose()`; status
  blijft pending, `edited_by_user` gaat het audit-spoor én de
  openstaand-voorstel-nota in (`openProposalsNote` in core.js) zodat de AI in de
  volgende beurt met de bewerkte versie verder rekent. De bewerkbare velden per
  write-tool staan (tijdelijk, tot A2UI een server-schema levert) in
  `EDITABLE_FIELDS` in [`lib/assistantActions.js`](../lib/assistantActions.js),
  met een registry-contract-test + propose-roundtrip-test.
- **RLS-plicht**: `ctx.db` is altijd de RLS-gebonden client (user-JWT). Een tool
  implementeert nooit eigen autorisatie-filtering; de database bepaalt zichtbaarheid.
- **Render is server-side en deterministisch**: kaarten komen uit `render*`-helpers over
  tool-output, nooit uit modeltekst. Prompt-injectie via data kan zo geen UI fabriceren.
- **Testplicht**: elke tool-functie en render-helper krijgt een node:test in dezelfde PR
  en valt onder de mutatie-ratchet (eigen groep per pack). Het descriptor-contract
  (description, schema, labels) ligt per pack exact vast in de test: een gewijzigde
  description verandert de tool-selectie en hoort dus een test te breken (en gaat
  daarna door de eval-gate).
- Het model krijgt alleen `data` terug (compact); `render` gaat rechtstreeks naar de client.
- **Consolidatie boven wildgroei**: één read- + hooguit één-à-twee write-tools per
  module (taak-gericht, niet endpoint-gericht). Tool-search/deferred loading is
  bewust uitgesteld; herbezoek wanneer de per-huishouden-gefilterde set structureel
  >20–25 tools of >10K tokens wordt. De meta-test
  [`tests/assistantCoverage.test.js`](../tests/assistantCoverage.test.js) bewaakt beide:
  elke `kind:'data'`-module heeft een manifest of staat expliciet op `NO_ASSISTANT`
  (geen stil dekkingsgat), en de totale set blijft onder de herbezoek-drempel.
- **Manifest = de enige declaratie per module.** Elke skill-file exporteert één
  `<MODULE>_MANIFEST { moduleKey, label, brief, tools }`;
  [`tools/index.js`](../supabase/functions/_shared/tools/index.js) leidt `ASSISTANT_TOOLS`
  + `MODULE_BRIEFS` af uit de `MANIFESTS`-lijst — een nieuwe module = één import + één
  regel, geen tweede hand-gelijstte array die kan uitlopen. Elke tool draagt daarnaast
  een **`risk`-tier** (`read` | `write` | `financial` | `destructive`) die de
  capability-laag (§11) voedt; het contract-testbestand pint de tier per tool exact vast.

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
  golden-set (`tests/assistant-golden.json` via [`scripts/assistant-eval.mjs`](../scripts/assistant-eval.mjs))
  en mag er **geen regressie** zijn t.o.v. de baseline
  ([`assistant-eval-baseline.json`](../assistant-eval-baseline.json)). De geautomatiseerde
  gate scoort **tool-selectie-F1, args-subset-match en no-tool-accuracy** (beurt 1). NL-toon
  en groundedness zijn (nog) géén geautomatiseerde judge — die borg je via handmatige
  trace-review (§7); een LLM-as-judge daarvoor is een openstaande verbetering.
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

- **Assistent overal, AI-first (AI-10 — bewuste herziening van plan 23 §5).**
  De chat leeft app-breed (één gespreksstate in `lib/assistantProvider.js`) en
  opent als sheet óver elk scherm (`lib/AssistantSheet.js`): prominent, nooit
  blokkerend. Module-FAB's zijn AI-first: tik → chat met invoer-focus en
  scherm-context; **"Zelf invoeren" is de altijd-zichtbare uitwijk** naar de
  klassieke editor — controle blijft bij de gebruiker. Scherm-context gaat mee
  als `screen` (moduleKey) en is in de prompt expliciet "aanwijzing, geen
  beperking".

- **Beknopt is de default.** Antwoorden zijn 1–3 zinnen; gegevens staan in de
  server-gerenderde kaarten, niet in lopende tekst. Details bereiken gebruikers via
  `link`-nodes (deep-link naar het module-scherm). Alleen op expliciet verzoek
  ("geef me een uitgebreid overzicht") mag een lang antwoord. Dit is in de
  systemprompt verankerd (BEKNOPT-blok); breedsprakigheid vang je nu via handmatige
  trace-review (§6) — een geautomatiseerde NL-toon-judge is nog niet gebouwd.
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
- **Node-types (AI-12 + AI-16 ronde 1, [plan 26](plans/26-gen-ui-componenten.md)):**
  `text, card, list, keyvalue, confirm_action, link, recipe, chart, schedule, choice`.
  Een nieuw type whitelist je op vier plekken client-side (`CATALOG_TYPES` +
  `normalizeNode` + `treeToText` in `lib/assistantUi.js`, renderer in
  `lib/AssistantMessageView.js`) plus een server-side `render*`-helper; de exacte set
  ligt vast in `tests/assistantUi.test.js`. `recipe` (titel, porties, ingrediënten,
  bereiding) is de recept-kaart waarop de gebruiker over een AI-recept beslist.
- **Interactieve nodes (AI-16):** pure interactie-logica leeft in
  `lib/assistantGenUi.js` (unit-getest + ratchet), de renderer blijft dun. Regels:
  (a) élke nieuwe server-node draagt een `text`-fallback zodat oudere clients
  leesbaar degraderen; (b) een `choice`-tik stuurt zijn `reply` als gewone
  gebruikersbeurt — nooit args of tool-calls vanaf een kaart (HITL blijft de enige
  schrijfroute); (c) `chart` is één-serie/één-hue met verplicht relief (waarde-labels
  + a11y-label per staaf + `treeToText` als tabelvorm); (d) live herrekening (zoals
  de porties-stepper op `recipe`) is client-lokaal en puur — het opgeslagen voorstel
  verandert er niet door mee; (e) `schedule`-`today` komt van de server (`ctx.today`),
  de client rekent niet met klok/tijdzone.
- **Rijke preview bij een write-voorstel:** een `propose()` mag naast `items`/`args` een
  `preview`-array met render-nodes teruggeven; de harness (index.ts) toont die vóór de
  `confirm_action`-kaart. Zo verschijnt de recept-kaart bij het opslaan-voorstel zonder
  de HITL-node zelf te verzwaren.

## 10. Actie-orkestratie (stap voor stap, AI-12)

Samengestelde verzoeken worden niet in één klap uitgevoerd; de agent componeert de
bestaande **atomaire** HITL-tools. Drie compositie-hendels, geen nieuwe transactie:

1. **Multi-item binnen één tool** (`items[]`): veel van dezelfde actie → één kaart.
2. **Meerdere kaarten in één beurt**: verschillende acties die bij één beslissing horen
   (elk blijft een losse, undo-bare `role='action'`-rij).
3. **Chip-ketting over beurten**: echte beslispunten na elkaar; de volgende stap komt via
   `suggest_replies`, gebruiker-geïnitieerd (geen server-auto-continuation).

De agent-policy (systemprompt) bepaalt bundelen (één beslissing, laag-risico) vs. rijgen
(gebruiker moet eerst iets goedkeuren). **Recept-flow als kanoniek voorbeeld:** koken/
recept/boodschappen → éérst `maaltijden_recept_zoeken`; niet gevonden →
`maaltijden_recept_opslaan` stelt een recept-kaart voor; pas ná goedkeuring inplannen
(`maaltijden_plannen` mét `recipe_id`) en boodschappen. Kaal inplannen ("plan vrijdag
lasagne in") blijft één directe `maaltijden_plannen`-titel. Bundelen is een
**presentatie**-laag: staan er ≥2 voorstellen open, dan biedt de client één *"Akkoord met
alles"* aan die ze via het bestaande confirm-endpoint na elkaar bevestigt — elke actie
blijft server-side atomair en los undo-baar (`pendingActionIds` in `lib/assistantUi.js`).
- Het wire-contract volgt de A2UI v0.9-message-types (`beginRendering`, `surfaceUpdate`,
  `dataModelUpdate`, `deleteSurface`) zodra AI-7 landt; de platte tree blijft als
  compat-vorm werken. Client-acties lopen uitsluitend via de whitelist in
  `lib/assistantActions.js` (onAction-bridge).

## 11. Capability-laag — wie mag de assistent wat laten doen (B4)

Een aparte autorisatielaag **náást** RLS en de module-toggle, want geen van beide dekt
"mag de assistent namens dít lid een actie van dit risico uitvoeren" (use-case: parental
control — kinderen mogen niets laten boeken/verwijderen).

- **Drie lagen, niet één:** RLS regelt rij-toegang; de module-toggle regelt óf een
  module meedoet; de capability-laag regelt welke **acties** een lid mag laten uitvoeren.
- **Pure policy:** [`lib/aiCapabilities.js`](../lib/aiCapabilities.js) — `requiredCapabilities`
  (tool → benodigde capabilities uit de `risk`-tier), `grantedCapabilities` (default-on;
  `AI_CAPABILITIES` = `ai:write` / `ai:spend` / `ai:destructive`) en `canUseTool`. Reads
  vereisen niets; een write vraagt `ai:write`, financieel ook `ai:spend`, destructief ook
  `ai:destructive`. Unit-getest + mutatie-ratchet.
- **Opslag:** migratie `0074` — `user_ai_capabilities(household_id, profile_id,
  capability_key, allowed)`, **default-on** (alleen intrekkingen opgeslagen, spiegelt de
  module-toggles). RLS: de **owner** beheert per lid; een lid **leest** zijn eigen stand
  maar wijzigt niet (parental control mag een lid niet terugdraaien).
- **Server-afgedwongen, twee punten** (fail-open naar het huidige gedrag bij een
  query-fout — RLS blijft de backstop): `filterTools` krijgt in
  [`assistant/index.ts`](../supabase/functions/assistant/index.ts) een `canUse`-poort zodat
  het model een verboden tool niet eens ziet, én er is een her-check vóór `execute` zodat
  een intussen ingetrokken recht niet via een oud voorstel doorglipt. Dezelfde harness
  leidt nu óók de **moduleset server-side** af (uit `household_modules`/`user_module_prefs`)
  i.p.v. de client-`enabledModuleKeys` te vertrouwen — de client bepaalt de tools niet meer.
- **App↔edge-brug:** de edge importeert hiervoor de pure `lib/modules.js` +
  `lib/aiCapabilities.js` (dezelfde bronmodules als de app). Beide zijn side-effect-vrij;
  dit is de eerste gedeelde import over de app/edge-grens.
- **Beheer:** owner-only sectie in het huishouden-scherm (per lid drie toggles) via de
  dunne hook [`lib/useAiCapabilities.js`](../lib/useAiCapabilities.js).
- **Nog niet:** een household-brede capability-laag (de seam `householdRevoked` in
  `grantedCapabilities` staat klaar) en zelf-restrictie door een lid — bewust uitgesteld.
