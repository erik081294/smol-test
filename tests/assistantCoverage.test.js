// Meta-test: maakt twee schaal-blinde-vlekken van de AI-actie-laag zichtbaar die
// anders stil blijven (fundament AI-actie-laag):
//   1. DEKKING — een data-module kan aan staan terwijl de assistent 'm niet kan
//      bereiken (geen manifest → geen tools, geen brief). Elke onbedekte module moet
//      een EXPLICIETE keuze mét reden zijn, niet een vergeten gat.
//   2. BUDGET  — de toolset mag niet ongemerkt over de herbezoek-drempel groeien
//      (guidelines §2/§4: dan is deferred/tool-search-loading nodig, geen hogere limiet).
// Zoals tests/assistantGolden.test.js bewaakt dit een registry-eigenschap; er is geen
// muteerbare bronmodule → het staat op UNMUTATED_TESTS in scripts/mutation-groups.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../lib/modules.js';
import { MANIFESTS, ASSISTANT_TOOLS } from '../supabase/functions/_shared/tools/index.js';

// Data-modules die (nog) bewust géén assistent-tools hebben. Elke rij is een keuze
// mét reden; fase 2 dicht deze via de tool-factory + logica-brug. Zolang een module
// hier staat kan hij niet stil buiten de assistent vallen — en zodra hij een manifest
// krijgt, faalt de stale-check hieronder tot de rij hier weg is.
// AI-19 fase A (plan 27, 2026-07-06): alle data-modules hebben nu een tool-pack.
// De lijst is leeg maar blijft bestaan als contract: een toekomstige module die
// bewust géén assistent-toegang krijgt, hoort hier mét reden.
const NO_ASSISTANT = {};

test('dekking: elke data-module heeft een manifest of staat expliciet op NO_ASSISTANT', () => {
  const withManifest = new Set(MANIFESTS.map((m) => m.moduleKey));
  for (const m of MODULES.filter((mod) => mod.kind === 'data')) {
    const covered = withManifest.has(m.key) || Object.prototype.hasOwnProperty.call(NO_ASSISTANT, m.key);
    assert.ok(
      covered,
      `data-module '${m.key}' heeft geen assistent-tools én staat niet op NO_ASSISTANT — ` +
        `stil gat: de module kan aan staan terwijl de assistent 'm niet kan bereiken`
    );
  }
});

test('dekking: NO_ASSISTANT bevat geen module die intussen wél tools heeft (stale opt-out)', () => {
  const withManifest = new Set(MANIFESTS.map((m) => m.moduleKey));
  for (const key of Object.keys(NO_ASSISTANT)) {
    assert.ok(!withManifest.has(key), `NO_ASSISTANT['${key}'] is stale — de module heeft nu een manifest; haal 'm van de lijst`);
    assert.ok(MODULES.some((m) => m.key === key), `NO_ASSISTANT['${key}'] is geen bestaande module`);
  }
});

test('budget: de totale toolset blijft onder de herbezoek-drempel (guidelines §2/§4)', () => {
  // §1/§2: herbezoek de aggregator-aanpak (deferred/tool-search-loading) zodra de
  // per-huishouden-gefilterde set structureel >20-25 tools wordt. De totale set is de
  // bovengrens daarop; boven de drempel is dit een SIGNAAL, geen hogere limiet.
  const BUDGET_REVISIT = 25;
  assert.ok(
    ASSISTANT_TOOLS.length <= BUDGET_REVISIT,
    `${ASSISTANT_TOOLS.length} tools totaal — boven ${BUDGET_REVISIT}: tijd voor deferred/tool-search-loading (§4)`
  );
  // Per module taak-gericht consolideren (§1: geen endpoint-per-tabel-wildgroei).
  const perModule = {};
  for (const t of ASSISTANT_TOOLS) perModule[t.moduleKey] = (perModule[t.moduleKey] ?? 0) + 1;
  for (const [k, n] of Object.entries(perModule)) {
    assert.ok(n <= 5, `module '${k}' heeft ${n} tools — consolideer (guidelines §1: taak-gericht, niet endpoint-gericht)`);
  }
});
