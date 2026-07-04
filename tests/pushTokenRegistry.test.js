// Units voor de push-token-administratie bij uitloggen (Plat-1, platform-review
// 2026-07-04). Zie lib/pushTokenRegistry.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberPushToken, registeredPushToken, unregisterPushToken } from '../lib/pushTokenRegistry.js';

// Fake supabase-client die de delete-keten vastlegt.
function fakeDb(log, { fail = false } = {}) {
  return {
    from(table) {
      return {
        delete() {
          return {
            eq(col, val) {
              log.push({ table, col, val });
              return fail ? Promise.reject(new Error('offline')) : Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

test('unregister verwijdert precies de onthouden token-rij en vergeet het token', async () => {
  const log = [];
  rememberPushToken('ExponentPushToken[abc]');
  assert.equal(registeredPushToken(), 'ExponentPushToken[abc]');
  await unregisterPushToken(fakeDb(log));
  assert.deepEqual(log, [{ table: 'push_tokens', col: 'token', val: 'ExponentPushToken[abc]' }]);
  assert.equal(registeredPushToken(), null);
  // Tweede keer uitloggen: geen tweede delete (idempotent).
  await unregisterPushToken(fakeDb(log));
  assert.equal(log.length, 1);
});

test('zonder onthouden token gebeurt er niets; lege/rare waarden tellen niet als token', async () => {
  const log = [];
  rememberPushToken('');
  assert.equal(registeredPushToken(), null); // lege string is géén token (> 0-grens)
  await unregisterPushToken(fakeDb(log));
  rememberPushToken(undefined);
  assert.equal(registeredPushToken(), null);
  rememberPushToken(123); // niet-string → genegeerd
  assert.equal(registeredPushToken(), null);
  await unregisterPushToken(fakeDb(log));
  assert.deepEqual(log, []);
});

test('een falende delete gooit niet (uitloggen mag hier nooit op stranden)', async () => {
  const log = [];
  rememberPushToken('ExponentPushToken[x]');
  await assert.doesNotReject(unregisterPushToken(fakeDb(log, { fail: true })));
  assert.equal(registeredPushToken(), null);
});
