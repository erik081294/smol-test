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

test('byteLen: grenswaarden van elke UTF-8-band (0x7F/0x80/0x7FF/0x800/0xFFFF)', () => {
  assert.equal(byteLen(String.fromCodePoint(0x7f)), 1);   // laatste 1-byte code point
  assert.equal(byteLen(String.fromCodePoint(0x80)), 2);   // eerste 2-byte code point
  assert.equal(byteLen(String.fromCodePoint(0x7ff)), 2);  // laatste 2-byte code point
  assert.equal(byteLen(String.fromCodePoint(0x800)), 3);  // eerste 3-byte code point
  assert.equal(byteLen(String.fromCodePoint(0xffff)), 3); // laatste BMP 3-byte code point
});

test('splitByBytes: een precies gevulde chunk splitst NIET vroegtijdig (grens >, niet >=)', () => {
  // 4 ascii-bytes bij maxBytes 4 → één chunk (4+... pas de 5e byte breekt).
  assert.deepEqual(splitByBytes('xxxx', 4), ['xxxx']);
  // 5e byte valt net buiten → tweede chunk.
  assert.deepEqual(splitByBytes('xxxxx', 4), ['xxxx', 'x']);
});

test('splitByBytes: meerdere volle chunks + rest, in volgorde en met exacte grootte', () => {
  const value = 'abcdefghij'; // 10 ascii-bytes
  const parts = splitByBytes(value, 3);
  assert.deepEqual(parts, ['abc', 'def', 'ghi', 'j']); // volgorde + grenzen
  assert.ok(parts.every((p) => byteLen(p) <= 3));
  assert.equal(parts.join(''), value); // samenvoegen in volgorde geeft het origineel
});

test('splitByBytes: een code point groter dan maxBytes blijft heel (kan niet splitsen)', () => {
  // 😀 = 4 bytes, maxBytes 3: de && cur-guard voorkomt een lege chunk vooraf.
  assert.deepEqual(splitByBytes('😀', 3), ['😀']);
  assert.deepEqual(splitByBytes('a😀', 3), ['a', '😀']); // 'a' vol genoeg, emoji apart
});

test('splitByBytes: gemengde multibyte-inhoud houdt elke chunk binnen de bytelimiet', () => {
  const value = 'é€aé€'; // 2+3+1+2+3 = 11 bytes
  const parts = splitByBytes(value, 4);
  assert.ok(parts.every((p) => byteLen(p) <= 4), 'geen enkele chunk overschrijdt de limiet');
  assert.equal(parts.join(''), value, 'volledige inhoud behouden na samenvoegen');
});

test('safeKey laat geldige sleutels intact en saneert de rest', () => {
  assert.equal(safeKey('sb-abcdef-auth-token'), 'sb-abcdef-auth-token');
  assert.equal(safeKey('a.b_c-1'), 'a.b_c-1');
  assert.equal(safeKey('a/b c:d'), 'a_b_c_d');
});
