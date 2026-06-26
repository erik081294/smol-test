// Bewaakt dat de mutatie-GROUPS synchroon blijven met de testsuite — zónder Stryker te
// laden (we lezen scripts/mutation-groups.mjs, de pure data-laag).
//
// Achtergrond: GROUPS in scripts/mutation-groups.mjs koppelt handmatig elke testfile aan de
// bronbestanden die hij dekt. Bij een review bleek dat geteste modules (realtimeHub,
// secureStorage) er stilletjes buiten vielen → ze werden nooit gemuteerd, dus een regressie
// erin kwam ongezien door CI. Deze test maakt dat handmatige onderhoud zelf-bewaakt:
//   1. elke tests/<x>.test.js hoort in GROUPS te zitten (of expliciet op de UNMUTATED-lijst);
//   2. elke GROUPS-entry verwijst naar een bestaande testfile + bestaande bronbestanden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { GROUPS, UNMUTATED_TESTS } from '../scripts/mutation-groups.mjs';

const repoRoot = new URL('..', import.meta.url);
const rel = (p) => new URL(p, repoRoot);

const testFiles = readdirSync(rel('tests'))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => f.replace('.test.js', ''));
const groupedTests = new Set(GROUPS.map((g) => g.test));
const allowed = new Set(UNMUTATED_TESTS);

test('elke testfile zit in GROUPS of staat bewust op de UNMUTATED-lijst', () => {
  const orphans = testFiles.filter((t) => !groupedTests.has(t) && !allowed.has(t));
  assert.deepEqual(
    orphans, [],
    `Deze testfiles ontsnappen aan de mutatie-ratchet. Voeg een GROUPS-regel toe in ` +
    `scripts/mutation-groups.mjs (en herijk de baseline), óf zet de naam in UNMUTATED_TESTS ` +
    `met uitleg waarom: ${orphans.join(', ')}`,
  );
});

test('elke GROUPS-entry verwijst naar een bestaande testfile en bestaande bronbestanden', () => {
  for (const g of GROUPS) {
    assert.ok(existsSync(rel(`tests/${g.test}.test.js`)), `GROUPS verwijst naar ontbrekende tests/${g.test}.test.js`);
    for (const src of g.srcs) {
      assert.ok(existsSync(rel(src)), `GROUPS-bron bestaat niet: ${src} (groep '${g.test}')`);
    }
  }
});
