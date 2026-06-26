// Borgt de gedrags-equivalentie-check die de mutatie-ratchet gebruikt om comment-only
// wijzigingen over te slaan (scripts/codeEquivalence.mjs). Cruciaal dat dit klopt: een
// false-positive ("equivalent") zou een ECHTE codewijziging ongemuteerd doorlaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBehaviorallyEqual } from '../scripts/codeEquivalence.mjs';

test('toegevoegde regel-comment / // @ts-check telt niet als wijziging', () => {
  const a = 'export const x = 1 + 2;\n';
  const b = '// @ts-check\nexport const x = 1 + 2; // som\n';
  assert.equal(isBehaviorallyEqual(a, b), true);
});

test('toegevoegd JSDoc-blok telt niet als wijziging', () => {
  const a = 'export function f(a) { return a; }\n';
  const b = '/**\n * @param {number} a\n */\nexport function f(a) { return a; }\n';
  assert.equal(isBehaviorallyEqual(a, b), true);
});

test('type-cast-comment met parens telt niet als wijziging', () => {
  const a = 'const n = m.get(k) + 1;\n';
  const b = 'const n = /** @type {number} */ (m.get(k)) + 1;\n';
  assert.equal(isBehaviorallyEqual(a, b), true);
});

test('alleen whitespace/opmaak telt niet als wijziging', () => {
  const a = 'export function f(a,b){return a+b;}\n';
  const b = 'export function f(a, b) {\n  return a + b;\n}\n';
  assert.equal(isBehaviorallyEqual(a, b), true);
});

test('een echte codewijziging (.getTime()) telt WEL', () => {
  const a = 'const d = x - y;\n';
  const b = 'const d = x.getTime() - y.getTime();\n';
  assert.equal(isBehaviorallyEqual(a, b), false);
});

test('een operator-wijziging telt WEL', () => {
  assert.equal(isBehaviorallyEqual('const z = a + b;\n', 'const z = a - b;\n'), false);
});

test('parse-fout → conservatief "wel gewijzigd" (nooit stilletjes overslaan)', () => {
  assert.equal(isBehaviorallyEqual('const a = 1;\n', 'const = ;;;\n'), false);
});
