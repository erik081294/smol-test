#!/usr/bin/env node
// Mutatietest-driver voor Huishoek.
//
// Waarom: regel-coverage zegt "deze regel is uitgevoerd", niet "een fout in deze
// regel zou een test laten falen". Mutatietesten meten dat laatste: we brengen
// kleine gedragsfouten (mutanten) aan in de broncode en kijken of de tests rood
// worden. Een gedode mutant = de test ving de bug. Een overlevende mutant = een
// gat in de effectiviteit van de test.
//
// Aanpak: per logica-module muteren we ALLEEN die module en draaien we ALLEEN de
// bijbehorende unit-test. Dat is snel (elke testfile draait in tienden van een
// seconde) én geeft zuivere attributie ("hoe goed vangt test X bugs in module X").
// We gebruiken Stryker's command-runner zodat de bestaande `node:test`-opzet
// (incl. de eigen ESM-loader in tests/register.mjs) onveranderd blijft.
//
// Gebruik:
//   node scripts/mutation.mjs            # volledige scope
//   node scripts/mutation.mjs fairness   # alleen groepen waarvan de naam matcht
//
// Output: reports/mutation/mutation.json (gecombineerd) + samenvattingstabel.

import { Stryker } from '@stryker-mutator/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// In-scope: pure, (vrijwel) dep-loze logica met een bijbehorende unit-test.
// Gegroepeerd per testfile: { test, srcs, exclude? }.
//   - test:    basisnaam van tests/<test>.test.js
//   - srcs:    bronbestanden die deze test geacht wordt af te dekken
//   - exclude: mutators die voor deze groep ruis opleveren (zie i18n: vertaaldata)
//
// Bewust NIET gemuteerd: React-gekoppelde lagen (lib/use*.js, lib/ui.js, schermen,
// componenten) — die hebben geen unit-tests en zouden alleen "survived" ruis geven.
// De RLS-integratietest vereist secrets/egress en valt buiten pure logica.
const GROUPS = [
  { test: 'activity', srcs: ['lib/activity.js'] },
  { test: 'agenda', srcs: ['lib/agenda.js'] },
  { test: 'appRoute', srcs: ['lib/appRoute.js'] },
  { test: 'barcode', srcs: ['lib/barcode.js'] },
  { test: 'buyFrequency', srcs: ['lib/buyFrequency.js'] },
  { test: 'choreLibrary', srcs: ['lib/choreLibrary.js'] },
  { test: 'cleaningTemplates', srcs: ['lib/cleaningTemplates.js'] },
  { test: 'dataCache', srcs: ['lib/dataCache.js'] },
  { test: 'decisions', srcs: ['lib/decisions.js'] },
  { test: 'expenses', srcs: ['lib/expenses.js'] },
  { test: 'fairness', srcs: ['lib/fairness.js'] },
  { test: 'favoriteGroceries', srcs: ['lib/favoriteGroceries.js'] },
  // i18n.js is grotendeels vertaaldata; StringLiteral-mutaties daarop zijn ruis.
  { test: 'i18n', srcs: ['lib/i18n.js'], exclude: ['StringLiteral'] },
  { test: 'insights', srcs: ['lib/insights.js'] },
  { test: 'mealPlan', srcs: ['lib/mealPlan.js'] },
  { test: 'modules', srcs: ['lib/modules.js'] },
  { test: 'navMeta', srcs: ['lib/navMeta.js'] },
  { test: 'notifications', srcs: ['lib/notifications.js'] },
  { test: 'offCatalog', srcs: ['lib/offCatalog.js'] },
  { test: 'offDelta', srcs: ['lib/offDelta.js'] },
  { test: 'pantry', srcs: ['lib/pantry.js'] },
  { test: 'pendingDeletes', srcs: ['lib/pendingDeletes.js'] },
  { test: 'plantCare', srcs: ['lib/plantCare.js'] },
  { test: 'plantPhoto', srcs: ['lib/plantPhoto.js'] },
  { test: 'plantTimeline', srcs: ['lib/plantTimeline.js'] },
  { test: 'priceTrack', srcs: ['lib/priceTrack.js'] },
  { test: 'productMatch', srcs: ['lib/productMatch.js'] },
  { test: 'realtimePatch', srcs: ['lib/realtimePatch.js'] },
  { test: 'recurrence', srcs: ['lib/recurrence.js'] },
  { test: 'recurringExpense', srcs: ['lib/recurringExpense.js'] },
  { test: 'reservations', srcs: ['lib/reservations.js'] },
  { test: 'rotation', srcs: ['lib/rotation.js'] },
  { test: 'visibility', srcs: ['lib/visibility.js'] },
  // offCategoryMap.js is een token-regeltabel (data); StringLiteral-mutaties op die
  // tokens zijn ruis — de test dekt de match-LOGICA + representatieve mappings, niet
  // elk los token. Zelfde redenering als i18n.
  { test: 'catalogCategory', srcs: ['lib/offCategoryMap.js'], exclude: ['StringLiteral'] },
  { test: 'constants-sync', srcs: ['lib/constants.js'] },
  { test: 'widgets', srcs: ['lib/widgets/grid.js', 'lib/widgets/summaries.js'] },
  // colorSchemes.js is een kleur/stijl-datatabel; StringLiteral = hex/kleurnamen (data).
  { test: 'widgets', srcs: ['lib/widgets/colorSchemes.js'], exclude: ['StringLiteral'] },
  { test: 'notify', srcs: ['supabase/functions/notify/core.js'] },
  { test: 'scanReceipt', srcs: ['supabase/functions/scan-receipt/core.js'] },
];

const filter = process.argv[2];
const groups = filter ? GROUPS.filter((g) => g.test.includes(filter) || g.srcs.some((s) => s.includes(filter))) : GROUPS;
if (groups.length === 0) {
  console.error(`Geen groepen matchen "${filter}". Beschikbaar: ${GROUPS.map((g) => g.test).join(', ')}`);
  process.exit(1);
}

const allFiles = {}; // fileName -> { language, source, mutants }
let dryError = false;

for (const group of groups) {
  const stryker = new Stryker({
    packageManager: 'npm',
    testRunner: 'command',
    commandRunner: { command: `node --import ./tests/register.mjs --test tests/${group.test}.test.js` },
    coverageAnalysis: 'off',
    mutate: group.srcs,
    // babel-preset-expo zet de 'decorators' parser-plugin aan; daarom geven we
    // Stryker een expliciete plugin-lijst zodat het niet óók 'decorators-legacy'
    // injecteert (anders: "Cannot use the decorators and decorators-legacy plugin together").
    mutator: { plugins: ['jsx'], ...(group.exclude ? { excludedMutations: group.exclude } : {}) },
    reporters: [],
    concurrency: Number(process.env.MUTATION_CONCURRENCY) || 6,
    timeoutMS: 20000,
    tempDirName: '.stryker-tmp',
    cleanTempDir: true,
    logLevel: 'error',
  });

  process.stdout.write(`• ${group.test} (${group.srcs.join(', ')}) … `);
  try {
    const results = await stryker.runMutationTest();
    // Groepeer resultaten per bestand voor het gecombineerde rapport.
    const byFile = {};
    for (const m of results) {
      (byFile[m.fileName] ||= []).push(m);
    }
    let killed = 0;
    let total = 0;
    for (const m of results) {
      if (m.status === 'Ignored' || m.status === 'NoCoverage') continue;
      total += 1;
      if (m.status === 'Killed' || m.status === 'Timeout') killed += 1;
    }
    const score = total ? ((killed / total) * 100).toFixed(1) : 'n.v.t.';
    console.log(`${score}% (${killed}/${total})`);
    // Vul het gecombineerde files-blok (relatieve paden).
    for (const [abs, mutants] of Object.entries(byFile)) {
      const rel = path.relative(process.cwd(), abs);
      allFiles[rel] = {
        language: 'javascript',
        mutants: mutants.map((m) => ({
          id: m.id,
          mutatorName: m.mutatorName,
          replacement: m.replacement,
          status: m.status,
          location: m.location,
        })),
      };
    }
  } catch (err) {
    dryError = true;
    console.log(`FOUT: ${err.message}`);
  }
}

// Schrijf gecombineerd rapport (Stryker-achtig schema, voldoende voor analyse).
mkdirSync('reports/mutation', { recursive: true });
const combined = { schemaVersion: '1.0', generatedAt: new Date().toISOString(), files: allFiles };
writeFileSync('reports/mutation/mutation.json', JSON.stringify(combined, null, 2));

// Samenvatting per module + totaal.
const rows = [];
let gKilled = 0;
let gTotal = 0;
for (const [file, data] of Object.entries(allFiles)) {
  let killed = 0;
  let survived = 0;
  let total = 0;
  for (const m of data.mutants) {
    if (m.status === 'Ignored' || m.status === 'NoCoverage') continue;
    total += 1;
    if (m.status === 'Killed' || m.status === 'Timeout') killed += 1;
    else survived += 1;
  }
  gKilled += killed;
  gTotal += total;
  rows.push({ file, score: total ? (killed / total) * 100 : 0, killed, survived, total });
}
rows.sort((a, b) => a.score - b.score);

console.log('\n=== Mutatie-score per module (zwakste eerst) ===');
console.log('score%  killed/total  survived  module');
for (const r of rows) {
  console.log(`${r.score.toFixed(1).padStart(6)}  ${`${r.killed}/${r.total}`.padStart(11)}  ${String(r.survived).padStart(8)}  ${r.file}`);
}
console.log('-----------------------------------------------');
console.log(`TOTAAL: ${gTotal ? ((gKilled / gTotal) * 100).toFixed(2) : '0'}%  (${gKilled}/${gTotal})  survived=${gTotal - gKilled}`);
console.log('\nGecombineerd rapport: reports/mutation/mutation.json');

process.exit(dryError ? 1 : 0);
