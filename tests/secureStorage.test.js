// Units voor de pure helpers van de SecureStore-sessieadapter (SEC-3).
// Zie lib/secureStorage.js — de adapter zelf is impure (expo-secure-store, lazy
// ge-require't en alleen op toestel) en valt buiten deze node-tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byteLen, splitByBytes, safeKey } from '../lib/secureStorage.js';

test('byteLen telt UTF-8-bytes (ascii, 2-byte, 3-byte, surrogate-paar)', () => {
  assert.equal(byteLen(''), 0);
  assert.equal(byteLen('abc'), 3);
  assert.equal(byteLen('é'), 2);       // U+00E9
  assert.equal(byteLen('€'), 3);       // U+20AC
  assert.equal(byteLen('😀'), 4);      // surrogate-paar → 4 bytes
  assert.equal(byteLen('a😀b'), 6);    // 1 + 4 + 1
});

test('splitByBytes houdt elk stuk ≤ maxBytes en behoudt de inhoud bij concatenatie', () => {
  const value = 'x'.repeat(50);
  const parts = splitByBytes(value, 20);
  assert.ok(parts.every((p) => byteLen(p) <= 20), 'elk stuk past binnen de bytelimiet');
  assert.equal(parts.join(''), value, 'samenvoegen geeft het origineel terug');
  assert.deepEqual(parts.map((p) => p.length), [20, 20, 10]);
});

test('splitByBytes knipt nooit een code-point (emoji) doormidden', () => {
  // Twee emoji's (elk 4 bytes) met maxBytes=5: na de eerste emoji (4 bytes) past de
  // tweede er niet meer bij → elke emoji belandt heel in een eigen stuk.
  const value = '😀😀';
  const parts = splitByBytes(value, 5);
  assert.deepEqual(parts, ['😀', '😀']);
  assert.ok(parts.every((p) => byteLen(p) <= 5));
  assert.equal(parts.join(''), value);
});

test('splitByBytes geeft [""] voor lege invoer', () => {
  assert.deepEqual(splitByBytes('', 10), ['']);
});

test('safeKey laat geldige sleutels intact en saneert de rest', () => {
  assert.equal(safeKey('sb-abcdef-auth-token'), 'sb-abcdef-auth-token');
  assert.equal(safeKey('a.b_c-1'), 'a.b_c-1');
  assert.equal(safeKey('a/b c:d'), 'a_b_c_d');
});
