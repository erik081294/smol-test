import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe as describeError, runResult } from '../lib/dbResult.js';

// console.warn dempen: runResult logt bij een fout bewust, maar dat is ruis in de testuitvoer.
const origWarn = console.warn;
function silenceWarn(fn) {
  return async () => { console.warn = () => {}; try { await fn(); } finally { console.warn = origWarn; } };
}

test('describe: geen error → vaste tekst', () => {
  assert.equal(describeError(null), 'Onbekende fout');
  assert.equal(describeError(undefined), 'Onbekende fout');
});

test('describe: message wint van hint en String', () => {
  assert.equal(describeError({ message: 'kapot', hint: 'tip' }), 'kapot');
});

test('describe: valt terug op hint als message ontbreekt', () => {
  assert.equal(describeError({ hint: 'probeer opnieuw' }), 'probeer opnieuw');
});

test('describe: valt terug op String als message én hint ontbreken', () => {
  assert.equal(describeError('platte string'), 'platte string');
  assert.equal(describeError({}), '[object Object]');
});

test('runResult: succes geeft de data en error null', silenceWarn(async () => {
  const rows = [{ id: 1 }];
  const res = await runResult(Promise.resolve({ data: rows, error: null }));
  assert.deepEqual(res, { data: rows, error: null });
}));

test('runResult: lege lijst blijft een lege lijst (geen fallback-verwarring)', silenceWarn(async () => {
  const res = await runResult(Promise.resolve({ data: [], error: null }));
  // Cruciaal voor P0: een geslaagde lege load is data=[], NIET null → onderscheidbaar van fout.
  assert.deepEqual(res, { data: [], error: null });
}));

test('runResult: data null bij succes → null, geen fout', silenceWarn(async () => {
  const res = await runResult(Promise.resolve({ data: null, error: null }));
  assert.deepEqual(res, { data: null, error: null });
}));

test('runResult: query-fout → data null én de error doorgegeven', silenceWarn(async () => {
  const err = { message: 'offline' };
  const res = await runResult(Promise.resolve({ data: null, error: err }));
  assert.equal(res.data, null);
  assert.equal(res.error, err);
}));

test('runResult: fout heeft voorrang ook als er (stale) data meekomt', silenceWarn(async () => {
  const err = { message: 'timeout' };
  const res = await runResult(Promise.resolve({ data: [{ id: 9 }], error: err }));
  assert.equal(res.data, null);
  assert.equal(res.error, err);
}));

test('runResult: verworpen promise → data null, error is de exception', silenceWarn(async () => {
  const boom = new Error('netwerk down');
  const res = await runResult(Promise.reject(boom));
  assert.equal(res.data, null);
  assert.equal(res.error, boom);
}));
