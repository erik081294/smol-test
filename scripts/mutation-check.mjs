#!/usr/bin/env node
// Mutatie-ratchet: bewaakt dat de test-effectiviteit niet stilletjes wegzakt.
//
// De score per module staat vastgelegd in mutation-baseline.json. Deze check draait
// de mutatietest (standaard alleen voor de GEWIJZIGDE modules — snel en relevant) en
// faalt als een module's score meer dan TOLERANTIE onder zijn baseline zakt.
//
// Gebruik:
//   node scripts/mutation-check.mjs                  # check ALLE modules tegen de baseline
//   node scripts/mutation-check.mjs --since=origin/main  # alleen wat sinds <ref> wijzigde
//   node scripts/mutation-check.mjs --update          # (her)genereer de baseline (volledige run)
//
// In CI draait alleen de gewijzigde set, zodat een PR die module X niet raakt ook
// nooit op module Y kan vastlopen. Zie docs/mutatietesten.md.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GROUPS, runGroups } from './mutation.mjs';
import { isBehaviorallyEqual } from './codeEquivalence.mjs';

const BASELINE_PATH = 'mutation-baseline.json';
// Hoeveel procentpunt een module mag zakken vóór de check faalt. Klein, maar niet 0,
// zodat een enkele equivalente mutant in nieuwe code geen vals alarm geeft.
const TOLERANCE_PP = 1.0;

const args = process.argv.slice(2);
const sinceArg = args.find((a) => a.startsWith('--since='))?.slice('--since='.length);
const isUpdate = args.includes('--update');

function progress(group, res) {
  const label = `• ${group.test} (${group.srcs.join(', ')})`;
  if (res.error) { console.log(`${label} … FOUT: ${res.error.message}`); return; }
  console.log(`${label} … ${res.score.toFixed(1)}% (${res.killed}/${res.total})`);
}

// --- baseline (her)genereren -------------------------------------------------
async function updateBaseline() {
  console.log('Baseline (her)genereren — volledige mutatierun…\n');
  const { scores, errors } = await runGroups(GROUPS, { onProgress: progress });
  if (errors.length) {
    console.error(`\n${errors.length} groep(en) faalden; baseline NIET geschreven.`);
    process.exit(1);
  }
  let gk = 0;
  let gt = 0;
  const files = {};
  for (const [file, s] of Object.entries(scores)) {
    files[file] = { killed: s.killed, total: s.total, score: Number(s.score.toFixed(1)) };
    gk += s.killed; gt += s.total;
  }
  const baseline = {
    generatedAt: new Date().toISOString(),
    tolerancePp: TOLERANCE_PP,
    total: { killed: gk, total: gt, score: Number(((gk / gt) * 100).toFixed(1)) },
    files,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`\nBaseline geschreven naar ${BASELINE_PATH}: totaal ${baseline.total.score}% (${gk}/${gt}), ${Object.keys(files).length} modules.`);
}

// --- gewijzigde modules bepalen ----------------------------------------------
// Heeft dit bronbestand een ECHTE (gedrags)wijziging t.o.v. de basis, of alleen
// comments/opmaak? Een comment-only wijziging (bv. // @ts-check, JSDoc, een type-cast)
// kan de mutatie-score niet veranderen, dus die slaan we over — anders her-muteert één
// brede comment-sweep nodeloos álle modules (en flakt op timeout-ruis). Bij twijfel
// (bestand nieuw/onleesbaar of parse-fout) → true: liever onnodig testen dan iets missen.
function srcChangedBehaviorally(src, base) {
  let baseSrc;
  try {
    baseSrc = execFileSync('git', ['show', `${base}:${src}`], { encoding: 'utf8' });
  } catch {
    return true; // bestond niet in de basis → nieuw bestand = echte wijziging
  }
  let headSrc;
  try {
    headSrc = readFileSync(src, 'utf8');
  } catch {
    return true; // niet leesbaar (verwijderd?) → conservatief
  }
  return !isBehaviorallyEqual(baseSrc, headSrc);
}

function changedGroups(since) {
  let changed = [];
  let base = since;
  try {
    base = execFileSync('git', ['merge-base', since, 'HEAD'], { encoding: 'utf8' }).trim() || since;
    const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
    changed = out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    console.error(`Kon 'git diff' tegen ${since} niet draaien; val terug op ALLE modules.`);
    return GROUPS;
  }
  const changedSet = new Set(changed);
  // Kandidaten: een groep waarvan de testfile óf een bronbestand wijzigde.
  const candidates = GROUPS.filter((g) =>
    changedSet.has(`tests/${g.test}.test.js`) || g.srcs.some((s) => changedSet.has(s)));
  // Relevant = testfile wijzigde (tests bepalen de score) óf een bron met een ECHTE
  // gedragswijziging. Alleen-comment/opmaak-wijzigingen vallen weg.
  const groups = candidates.filter((g) =>
    changedSet.has(`tests/${g.test}.test.js`) ||
    g.srcs.some((s) => changedSet.has(s) && srcChangedBehaviorally(s, base)));
  const skipped = candidates.filter((g) => !groups.includes(g));
  if (skipped.length) {
    console.log(`Overgeslagen — alleen comments/opmaak gewijzigd: ${skipped.map((g) => g.test).join(', ')}`);
  }
  return groups;
}

// --- de eigenlijke check -----------------------------------------------------
async function check() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`Geen ${BASELINE_PATH} gevonden. Genereer er eerst één met:\n  npm run test:mutation:baseline`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const tol = baseline.tolerancePp ?? TOLERANCE_PP;

  const groups = sinceArg ? changedGroups(sinceArg) : GROUPS;
  if (groups.length === 0) {
    console.log('Geen gemuteerde modules gewijzigd — niets te controleren. ✓');
    return;
  }
  console.log(`Mutatie-ratchet: ${groups.length} module-groep(en) controleren (tolerantie ${tol} pp)…\n`);

  const { scores, errors } = await runGroups(groups, { onProgress: progress });
  if (errors.length) {
    console.error(`\n${errors.length} groep(en) konden niet draaien — check afgebroken.`);
    process.exit(1);
  }

  const regressions = [];
  const newModules = [];
  for (const [file, s] of Object.entries(scores)) {
    const base = baseline.files[file];
    if (!base) { newModules.push({ file, score: s.score }); continue; }
    if (s.score < base.score - tol) {
      regressions.push({ file, from: base.score, to: Number(s.score.toFixed(1)), fromKT: `${base.killed}/${base.total}`, toKT: `${s.killed}/${s.total}` });
    }
  }

  for (const n of newModules) {
    console.log(`ℹ nieuwe module zonder baseline: ${n.file} (${n.score.toFixed(1)}%) — neem op via 'npm run test:mutation:baseline'.`);
  }

  if (regressions.length === 0) {
    console.log('\n✓ Geen daling in test-effectiviteit. Mutatie-ratchet groen.');
    return;
  }

  console.error('\n✗ Test-effectiviteit is gezakt in:');
  for (const r of regressions) {
    console.error(`   ${r.file}: ${r.from}% → ${r.to}%  (${r.fromKT} → ${r.toKT})`);
  }
  console.error(`
Een overlevende mutant betekent: een fout in deze regel zou GEEN test laten falen.
Bekijk welke mutanten overleven met:
   node scripts/mutation.mjs <module>      # bv. ${regressions[0].file.split('/').pop().replace('.js', '')}
en voeg een test toe die het gedrag vastpint (grenswaarde, volgorde, null-pad).

Is de daling terecht en bewust (bv. een equivalente mutant of verwijderde logica)?
Werk dan de baseline bij en commit 'm mee:
   npm run test:mutation:baseline
`);
  process.exit(1);
}

if (isUpdate) await updateBaseline();
else await check();
