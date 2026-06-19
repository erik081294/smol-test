import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  markPending, unmarkPending, isPending, pendingVersion, subscribePending, _resetPending,
} from '../lib/pendingDeletes.js';

test('markPending verbergt een id, unmarkPending toont het weer', () => {
  _resetPending();
  assert.equal(isPending('a'), false);
  markPending('a');
  assert.equal(isPending('a'), true);
  unmarkPending('a');
  assert.equal(isPending('a'), false);
});

test('markPending is idempotent en negeert null/undefined', () => {
  _resetPending();
  const v0 = pendingVersion();
  markPending('a');
  const v1 = pendingVersion();
  assert.equal(v1, v0 + 1);
  markPending('a');                       // al gemarkeerd → geen mutatie
  assert.equal(pendingVersion(), v1);
  markPending(null);                      // genegeerd
  markPending(undefined);                 // genegeerd
  assert.equal(pendingVersion(), v1);
});

test('unmarkPending van een onbekend id muteert niets', () => {
  _resetPending();
  markPending('a');
  const v = pendingVersion();
  unmarkPending('zzz');                   // niet aanwezig → geen mutatie
  assert.equal(pendingVersion(), v);
  unmarkPending('a');                     // wel aanwezig → mutatie
  assert.equal(pendingVersion(), v + 1);
});

test('subscribePending krijgt een melding bij elke mutatie en stopt na unsubscribe', () => {
  _resetPending();
  let calls = 0;
  const unsub = subscribePending(() => { calls += 1; });
  markPending('a');
  markPending('b');
  assert.equal(calls, 2);
  unmarkPending('a');
  assert.equal(calls, 3);
  unsub();
  markPending('c');                       // niemand luistert meer
  assert.equal(calls, 3);
});

test('meerdere ids kunnen tegelijk pending zijn', () => {
  _resetPending();
  markPending('a');
  markPending('b');
  assert.equal(isPending('a'), true);
  assert.equal(isPending('b'), true);
  unmarkPending('a');
  assert.equal(isPending('a'), false);
  assert.equal(isPending('b'), true);
});
