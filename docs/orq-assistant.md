# Orq-runbook — Huishoek Assistent (monitoring, traces, deployment)

Operationele handleiding voor de assistent-gateway (AI-2, plan 24 ronde A). Zusterdoc van
[`orq-receipt-scan.md`](orq-receipt-scan.md) (bonscan). Normatieve regels: [`assistent-architectuur.md`](assistent-architectuur.md).

## Setup

- **Workspace:** `evdn` (https://my.orq.ai/evdn). API-key = de *AI Studio*-key, in `.env`
  (`ORQ_API_KEY`, gitignored) én als Supabase-edge-secret.
- **Secrets op de edge function `assistant`:**
  - `ORQ_API_KEY` — verplicht.
  - `ORQ_ASSISTANT_MODEL` — mét provider-prefix (`google/eu.claude-sonnet-5`) →
    **v3-router (Responses API)**: dynamische tools + thread + metadata → rijke traces.
    Zónder prefix (`eu.claude-sonnet-5`) → legacy proxy-route (geen thread/metadata).
  - `ORQ_ASSISTANT_SHADOW_MODEL` — (AI-3, optioneel) schaduwmodel; leeg = uit.
- **Waarom de v3-router en niet een Deployment/Agent** (empirisch, 2026-07-04):
  `deployments/invoke` en `agents` (Responses) **negeren per-request tools** — onze
  tool-set is per huishouden dynamisch, dus die routes vallen af. De v3-router
  (`POST /v3/router/responses`) ondersteunt alle drie: tools ✓ `thread` ✓ `metadata` ✓
  (bewezen met function_call + trace_id). De systemprompt leeft daarom vóórlopig in
  `assistant/index.ts`; migreren naar een Orq-agent kan zodra Orq per-request tools op
  agents ondersteunt (guidelines §3 geldt dan volledig).
- **Aangemaakte Orq-entiteiten** (via MCP; blijven staan voor AI-3-experimenten):
  agent `huishoek_assistant` (persona + variabelen — toekomstige route), deployment
  `huishoek_assistant_live`. **Opruimbaar door Erik in het dashboard:** deployment
  `huishoek_assistant` (boilerplate-prompt), `huishoek_assistant_v2` (deprecated
  temperature-param) en agent `huishoek_toolprobe` (testprobe).

## Trace-conventies (wat je in Orq terugziet)

- `thread.id` = conversatie-id (alle beurten van één gesprek gegroepeerd), tag `assistant`.
- `metadata`: `feature=assistant`, `user=<sha256-16>`, `household=<sha256-16>` — gehasht,
  nooit PII (guidelines §7). Schaduwruns (AI-3): thread-tag `shadow`.

## Traces bekijken

- **Via de Orq MCP** (na koppeling — Erik: `claude mcp add --transport http orq
  https://my.orq.ai/v2/mcp --header "Authorization: Bearer <ORQ_API_KEY>"`):
  `list_traces` (filter op thread-id/model/tijd) → `list_spans` → `get_span` (volledige
  input/output/tool-calls van één beurt).
- **Dashboard:** https://my.orq.ai/evdn → Observability/Traces.
- **Bij een klacht** ("de assistent zei iets geks"): vraag de gebruiker wanneer ± het was →
  filter traces op tijd + household-hash → open de span → controleer (1) welke tools met
  welke args draaiden, (2) wat de tool-data was, (3) of het antwoord daarop grondt. Failure?
  → nieuwe golden-case in `tests/assistant-golden.json` (AI-3, guidelines §6).

## Vaste loop (wekelijks, ~10 min)

1. Traces van de week scannen (fouten, trage beurten, rare tool-keuzes).
2. Kosten-check: Orq-dashboard (workspace-snapshot) + `assistant_call_daily` in de DB.
3. Elke gevonden failure → golden-case; bij patroon → prompt-iteratie in de deployment
   (nieuwe versie) → eval-gate → publish.

## Limieten (DB is de rem, Orq is het zicht)

`record_assistant_call` (migratie 0068, fail-closed): 20/uur en 60/dag per gebruiker,
150/dag per huishouden, 10k/dag globaal. Aanpassen = constanten in
`supabase/functions/assistant/index.ts` + evt. RPC-defaults.
