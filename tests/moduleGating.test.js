// Meta-test voor de datalaag-module-gating (ARCH-3). Borgt dat "laad geen data van een
// uitgezette module" niet stil verwatert naarmate er modules/hooks bijkomen: elke
// useCollection-datatabel moet óf aan zijn module gegate zijn (module:'<key>'), óf
// bewust op de uitzonderingslijst staan. Zo wordt het overslaan van een tabel een
// expliciete, zichtbare keuze i.p.v. vergeten techniek-schuld.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MODULES } from '../lib/modules.js';

const libDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');

// Cross-cutting tabellen die BEWUST niet aan één module gegate worden:
//  - tasks:    zorgmodules (schoonmaak/planten/huisdieren/voertuigen) genereren taken die
//              in Taken/Vandaag verschijnen; gaten op 'taken' zou cross-module data verbergen.
//  - products: gedeelde catalogus-referentiedata, óók gelezen door de recept-picker
//              (maaltijden) en voorraad — hoort niet bij één module.
//  - tags/zones: labels/zones die over modules heen gebruikt worden.
// Een tabel hier toevoegen is een bewuste keuze; de test dwingt af dat het een keuze is.
const EXEMPT = new Set(['tasks', 'products', 'tags', 'zones']);

// Alle module-hooks (lib/use*.js), behalve de generieke useCollection zelf.
const hookFiles = readdirSync(libDir).filter((f) => /^use.*\.js$/.test(f) && f !== 'useCollection.js');

// Vind elke useCollection('<table>', { ... }) en pak het optie-blok tot de afsluitende '});'.
function collectionCalls(src) {
  const out = [];
  const re = /useCollection\(\s*'([a-z_]+)'/g;
  let m;
  while ((m = re.exec(src))) {
    const end = src.indexOf('});', m.index);
    out.push({ table: m[1], options: end === -1 ? src.slice(m.index) : src.slice(m.index, end + 3) });
  }
  return out;
}

test('elke useCollection-datatabel is gegate (module:) of staat bewust op de uitzonderingslijst', () => {
  let scanned = 0;
  for (const f of hookFiles) {
    const src = readFileSync(join(libDir, f), 'utf8');
    for (const { table, options } of collectionCalls(src)) {
      scanned += 1;
      if (EXEMPT.has(table)) continue;
      assert.match(
        options, /\bmodule:\s*'[a-z]+'/,
        `useCollection('${table}') in ${f} mist een module-gate (ARCH-3). `
        + `Voeg module:'<key>' toe, of zet de tabel bewust in EXEMPT met reden.`,
      );
    }
  }
  // Vangnet: als de scan niets vond is de regex stuk (en zou de test vals-groen zijn).
  assert.ok(scanned >= 10, `verwacht ≥10 useCollection-aanroepen, vond er ${scanned}`);
});

test('elke module-gate verwijst naar een bestaande, toggle-bare module', () => {
  const toggleable = new Set(MODULES.filter((m) => !m.core).map((m) => m.key));
  for (const f of hookFiles) {
    const src = readFileSync(join(libDir, f), 'utf8');
    const re = /\bmodule:\s*'([a-z]+)'/g;
    let m;
    while ((m = re.exec(src))) {
      assert.ok(toggleable.has(m[1]), `onbekende of kern-module-gate '${m[1]}' in ${f}`);
    }
  }
});

test('de custom data-hooks gaten via dezelfde gedeelde primitive (geen losse kopie)', () => {
  const meal = readFileSync(join(libDir, 'useMealPlan.js'), 'utf8');
  const exp = readFileSync(join(libDir, 'useExpenses.js'), 'utf8');
  assert.match(meal, /useGatedHouseholdId\(\s*'maaltijden'\s*\)/);
  assert.match(exp, /useGatedHouseholdId\(\s*'kosten'\s*\)/);
});
