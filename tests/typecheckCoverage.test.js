// Bewaakt de type-laag (zie het type-laag-plan + CLAUDE.md Definition of done).
//
// Achtergrond: de typecheck (tsconfig.check.json) draait OPT-IN — alleen .js-bestanden
// met een `// @ts-check`-regel worden gecontroleerd (checkJs:false). Zonder bewaking
// zou een nieuwe pure module stilletjes buiten de typecheck vallen, net zoals modules
// ooit buiten de mutatie-ratchet vielen (zie groupsCoverage.test.js). Daarom koppelen
// we de typecheck-scope hard aan de ratchet-scope (MUTATED_SOURCES):
//   1. elke gemuteerde bron begint met `// @ts-check`;
//   2. elke gemuteerde bron staat in de `include` van tsconfig.check.json (en omgekeerd).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUTATED_SOURCES } from '../scripts/mutation-groups.mjs';

const repoRoot = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, repoRoot), 'utf8');

test('elke gemuteerde bron begint met // @ts-check', () => {
  const missing = MUTATED_SOURCES.filter((src) => read(src).split('\n', 1)[0].trim() !== '// @ts-check');
  assert.deepEqual(
    missing, [],
    `Deze modules vallen onder de mutatie-ratchet maar missen de typecheck-opt-in. Zet ` +
    `'// @ts-check' op regel 1 en draai 'npm run typecheck': ${missing.join(', ')}`,
  );
});

test('tsconfig.check.json include dekt exact MUTATED_SOURCES', () => {
  // tsconfig.check.json is JSONC: strip de //-regelcommentaren vóór het parsen.
  const raw = read('tsconfig.check.json').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const include = new Set(JSON.parse(raw).include);
  const sources = new Set(MUTATED_SOURCES);
  const notIncluded = [...sources].filter((s) => !include.has(s));
  const stale = [...include].filter((s) => !sources.has(s));
  assert.deepEqual(notIncluded, [], `Ontbreekt in tsconfig.check.json 'include': ${notIncluded.join(', ')}`);
  assert.deepEqual(stale, [], `Staat in 'include' maar niet (meer) in MUTATED_SOURCES: ${stale.join(', ')}`);
});
