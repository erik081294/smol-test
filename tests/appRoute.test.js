import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appRoute } from '../lib/appRoute.js';

const base = { authLoading: false, session: null, hhLoading: false, hasFetched: false, households: [] };

test('appRoute: auth laadt nog -> loading', () => {
  assert.equal(appRoute({ ...base, authLoading: true }), 'loading');
});

test('appRoute: ingelogd maar huishoudens laden nog -> loading', () => {
  assert.equal(appRoute({ ...base, session: { user: 1 }, hhLoading: true }), 'loading');
});

test('appRoute: ingelogd, fetch nog niet afgerond -> loading (geen onboarding-flits)', () => {
  // De kern van UX-8: lege lijst die nog niet is opgehaald telt niet als "geen huishouden".
  assert.equal(appRoute({ ...base, session: { user: 1 }, hasFetched: false, households: [] }), 'loading');
});

test('appRoute: niet ingelogd (klaar met laden) -> auth', () => {
  assert.equal(appRoute({ ...base, session: null }), 'auth');
});

test('appRoute: ingelogd + gefetcht + 0 huishoudens -> onboarding', () => {
  assert.equal(appRoute({ ...base, session: { user: 1 }, hasFetched: true, households: [] }), 'onboarding');
});

test('appRoute: ingelogd + gefetcht + >=1 huishouden -> app', () => {
  assert.equal(appRoute({ ...base, session: { user: 1 }, hasFetched: true, households: [{ id: 'a' }] }), 'app');
});

test('appRoute: ontbrekende households-lijst valt veilig terug op onboarding', () => {
  assert.equal(appRoute({ ...base, session: { user: 1 }, hasFetched: true, households: undefined }), 'onboarding');
});
