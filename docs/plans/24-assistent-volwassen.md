# Plan 24 — Assistent volwassen (AI-2 … AI-9)

> Vervolg op [plan 23](23-assistent.md) (fase 1 live, device-bevestigd). Doel: de assistent
> uitbouwen tot een industry-leading setup — Orq-observability/evals/experiments als vaste
> werkwijze, chat-UX op Claude Code/Codex-niveau, een A2UI-compatibele gen-UI-laag en
> normatieve guidelines ([`docs/assistent-architectuur.md`](../assistent-architectuur.md)).
> Status per item: uitsluitend backlog §6.

## Kernbeslissingen (onderbouwing)

- **Deployment i.p.v. kale proxy.** Orq's rijke tracing én online evals/guardrails hangen aan
  Deployments; die ondersteunen tool-calling + SSE + variables + versioning. De agent-loop
  migreert dus naar `deployments/invoke`, met `thread_id` = conversatie-id en gehashte
  user/household-ids als identity/metadata (nooit PII in traces).
- **Eén agent, modulair.** Specialists pas bij aantoonbare noodzaak (criteria in de
  guidelines §4: >12 tools én F1-daling én eigen domeintoon; dan agents-as-tools, geen handoffs).
- **Repo = bron van waarheid voor evals.** Golden-set (`tests/assistant-golden.json`, ±60
  NL-cases incl. "geen tool"-bucket) synct via script naar een Orq-dataset; evaluators:
  schema-gate + tool-selectie-F1 (Python), NL-toon-judge (gekalibreerd), groundedness.
  Eval-gate in de DoD bij elke prompt-/tool-/modelwijziging.
- **GLM-5.2**: Orq-experiment (sonnet-5 vs glm-5.2 op de golden-set: F1/toon/kosten/latency)
  + optionele schaduwdraai via secret `ORQ_ASSISTANT_SHADOW_MODEL` (fire-and-forget, eigen
  dagcap, tag `shadow`, nooit naar de gebruiker).
- **A2UI-alignment zonder dep.** `lib/assistantUi.js` groeit naar het A2UI v0.9-model
  (surface + patch op component-id, gescheiden data-model, `onAction`-bridge met whitelist);
  de vier message-types worden het wire-contract, de platte tree blijft werken. De community
  RN-renderer (MVP) gebruiken we niet.
- **Streaming**: SSE-eventprotocol `delta | tool_status | tree | done | error` uit de edge
  function; app via `expo/fetch`-streaming (spike; fallback non-streaming, alternatief
  realtime-chunks). Markdown via `react-native-streamdown` (fallback markdown-display).
- **Geheugen v1**: `assistant_memories` met pgvector + 'dutch' tsvector, hybrid-search-RPC
  (RRF, over-fetch), expliciete remember-tool (HITL) + async extractie ná de beurt
  (aparte Orq-deployment, dedupe), transparantie-UX + beheer-scherm.

## Rondes (elk zelfstandig shipbaar)

| Ronde | Backlog | Inhoud |
|---|---|---|
| A | AI-2 | Orq-deployment `huishoek_assistant` (prompt/variables/versioning), invoke-migratie met trace-metadata, monitoring-runbook, guidelines-doc v1 |
| B | AI-3 | Golden-set + sync-script + evaluators + experiment sonnet-5 vs GLM-5.2 + schaduwdraai + eval-gate in DoD |
| C | AI-4 | Chat-persistentie: server-side schrijfpad naar `assistant_messages`, history uit DB, conversatielijst/hervatten/titels, migratie 0069 (`updated_at`) |
| D | AI-5 | SSE end-to-end + streamdown-markdown (lost ook platte `**markdown**` uit fase 1 op) |
| E | AI-6 | UX-poets: stop-knop (partial bewaren), retry, message-actions, tool-statusregels + collapsible, scroll-anchoring, haptics; tool-contract + `statusLabel`. **Deels vervroegd (2026-07-04):** antwoordopties via `suggest_replies`-pseudo-tool (AskUserQuestion-patroon: elke beurt 2–4 tikbare chips, vrij typen blijft altijd de "Other"-route) + BEKNOPT-prompt (1–3 zinnen, data in kaarten, details via deep-link) — zie guidelines §8. |
| F | AI-7 | A2UI-alignment: surface/patch-model, dataModel-store, `lib/assistantActions.js` (onAction-whitelist), +3 node-types (`progress`, `image`, `chips`) |
| G | AI-8 | Write-tools `propose_*` + HITL: action-bericht (args+TTL, pending) → bevestigingskaart → `execute_action` (valideert + voert opgeslagen args uit) → toast/undo |
| H | AI-9 | Geheugen v1: migratie 0074 (`assistant_memories` + hybrid-search-RPC), remember-tool, async extractor, beheer-scherm, memory zichtbaar in chat |

## Risico's

Exacte invoke-veldnamen (verifiëren via docs.orq.ai/llms.txt, eerste stap A) · RN
fetch-streaming op Android (spike vóór D) · streamdown-maturiteit (spike, fallback) ·
schaduwdraai-kosten (default uit, eigen cap) · Orq MCP nog niet gekoppeld (Erik-actie;
alles heeft REST-fallback).

## Verificatie-stramien

Unit (node:test + ratchet + typecheck) → live curl + trace-check (thread_id, gehashte
metadata) → golden-set-gate (vanaf B) → device-rooktest licht/donker per UI-ronde
(ronde-specifiek: abort-partial E, verlopen actionId G, RLS-memory-isolatie H) → docs
in dezelfde PR. Volledige tekst van het goedgekeurde plan: sessieplan 2026-07-04.
