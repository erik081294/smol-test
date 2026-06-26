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
//   node scripts/mutation.mjs fairness   # alleen groepen waarvan de naam/bron matcht
//
// Output: reports/mutation/mutation.json (gecombineerd) + samenvattingstabel.
// Zie ook docs/mutatietesten.md en scripts/mutation-check.mjs (CI-ratchet).

import { Stryker } from '@stryker-mutator/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
// Pure data (Stryker-vrij) — zie scripts/mutation-groups.mjs. Lokale bindingen + her-export
// zodat scripts/mutation-check.mjs (`from './mutation.mjs'`) ongewijzigd blijft werken.
import { GROUPS, MUTATED_SOURCES, selectGroups } from './mutation-groups.mjs';

export { GROUPS, MUTATED_SOURCES, selectGroups };

// V8 compile-cache: elke mutant start een vers `node`-proces dat dezelfde modules
// (date-fns!) opnieuw inlaadt. Eén gedeelde, absolute cache laat die processen de
// bytecode hergebruiken i.p.v. telkens opnieuw compileren. Staat in node_modules/.cache
// (git-genegeerd) en wordt door alle sandboxes via de node_modules-symlink gedeeld.
process.env.NODE_COMPILE_CACHE ||= path.resolve('node_modules/.cache/huishoek-mutation-cc');

const CORES = os.cpus()?.length || 4;

// Hoeveel mutanten Stryker tegelijk draait. Elke mutant is een vers node-proces dat
// tijdens het laden van date-fns even op I/O wacht; licht oversubscriben (2× cores)
// vult die gaten en is in de praktijk het snelst. Override met MUTATION_CONCURRENCY.
const CONCURRENCY = Number(process.env.MUTATION_CONCURRENCY) || 2 * CORES;

// Draai één groep door Stryker en geef de ruwe MutantResult[] terug.
async function runGroup(group) {
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
    concurrency: CONCURRENCY,
    timeoutMS: 20000,
    tempDirName: '.stryker-tmp',
    cleanTempDir: true,
    logLevel: 'error',
  });
  return stryker.runMutationTest();
}

// Tel een MutantResult[] om naar { killed, survived, total, timeout, score } (score in %).
// Ignored/NoCoverage tellen niet mee (geen test draaide ze).
//
// Timeout telt als killed: een mutant die een hang/oneindige lus veroorzaakt (bv. een
// gemuteerde lus-grens) is door de tests "gevangen" doordat het proces de tijdslimiet
// raakt — dat is een echte kill, geen survivor. We hebben die limiet dus nodig (anders
// hangt de hele run op zo'n mutant). We tellen timeouts wél apart, zodat zichtbaar is of
// een trage runner de score via timeouts opblaast i.p.v. via echte test-falingen.
export function tallyMutants(mutants) {
  let killed = 0;
  let timeout = 0;
  let total = 0;
  for (const m of mutants) {
    if (m.status === 'Ignored' || m.status === 'NoCoverage') continue;
    total += 1;
    if (m.status === 'Timeout') timeout += 1;
    if (m.status === 'Killed' || m.status === 'Timeout') killed += 1;
  }
  return { killed, survived: total - killed, total, timeout, score: total ? (killed / total) * 100 : 0 };
}

// Draai de gegeven groepen (sequentieel) en geef per bronbestand de resultaten + score.
//   -> { files: { [rel]: { mutants } }, scores: { [rel]: {killed,total,...} }, errors: [] }
//
// Snelheid: binnen één groep saturteert Stryker de cores al (mutanten draaien parallel),
// dus groepen tégelijk draaien helpt niet — het voegt alleen sandbox-/coördinatie-
// overhead toe (gemeten: langzamer). De winst zit in de V8 compile-cache (boven) +
// lichte oversubscription, en vooral in de ratchet die enkel de gewijzigde modules draait.
export async function runGroups(groups, { onProgress } = {}) {
  const files = {};
  const errors = [];
  for (const group of groups) {
    try {
      const results = await runGroup(group);
      const byFile = {};
      for (const m of results) (byFile[m.fileName] ||= []).push(m);
      for (const [abs, mutants] of Object.entries(byFile)) {
        const rel = path.relative(process.cwd(), abs);
        files[rel] = { language: 'javascript', mutants: mutants.map((m) => ({
          id: m.id, mutatorName: m.mutatorName, replacement: m.replacement, status: m.status, location: m.location,
        })) };
      }
      onProgress?.(group, tallyMutants(results));
    } catch (err) {
      errors.push({ group, error: err });
      onProgress?.(group, { error: err });
    }
  }
  const scores = {};
  for (const [rel, data] of Object.entries(files)) scores[rel] = tallyMutants(data.mutants);
  return { files, scores, errors };
}

// --- CLI ---------------------------------------------------------------------
async function main() {
  const filter = process.argv[2];
  const groups = selectGroups(filter);
  if (groups.length === 0) {
    console.error(`Geen groepen matchen "${filter}". Beschikbaar: ${GROUPS.map((g) => g.test).join(', ')}`);
    process.exit(1);
  }

  const { files, scores, errors } = await runGroups(groups, {
    onProgress: (group, res) => {
      const label = `• ${group.test} (${group.srcs.join(', ')})`;
      if (res.error) { console.log(`${label} … FOUT: ${res.error.message}`); return; }
      console.log(`${label} … ${res.score.toFixed(1)}% (${res.killed}/${res.total})`);
    },
  });

  mkdirSync('reports/mutation', { recursive: true });
  writeFileSync('reports/mutation/mutation.json', JSON.stringify(
    { schemaVersion: '1.0', generatedAt: new Date().toISOString(), files }, null, 2));

  const rows = Object.entries(scores).map(([file, s]) => ({ file, ...s })).sort((a, b) => a.score - b.score);
  let gKilled = 0;
  let gTotal = 0;
  let gTimeout = 0;
  console.log('\n=== Mutatie-score per module (zwakste eerst) ===');
  console.log('score%  killed/total  survived  module');
  for (const r of rows) {
    gKilled += r.killed; gTotal += r.total; gTimeout += r.timeout ?? 0;
    console.log(`${r.score.toFixed(1).padStart(6)}  ${`${r.killed}/${r.total}`.padStart(11)}  ${String(r.survived).padStart(8)}  ${r.file}`);
  }
  console.log('-----------------------------------------------');
  console.log(`TOTAAL: ${gTotal ? ((gKilled / gTotal) * 100).toFixed(2) : '0'}%  (${gKilled}/${gTotal})  survived=${gTotal - gKilled}  timeout-kills=${gTimeout}`);
  console.log('\nGecombineerd rapport: reports/mutation/mutation.json');
  process.exit(errors.length ? 1 : 0);
}

// Alleen draaien als dit bestand direct wordt uitgevoerd (niet bij import).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
