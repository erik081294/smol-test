// Units voor de pure uitnodigings-logica (lib/invites.js). Dekt de statusvolgorde,
// de expiry-grens, link-bouw en token-normalisatie — inclusief de default-params en
// null/ontbrekende velden (de terugkerende mutatie-gaten uit CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEB_BASE_URL, inviteStatus, isRedeemable, inviteUrl, normalizeToken, hoursUntilExpiry,
} from '../lib/invites.js';

const NOW = new Date('2026-06-25T12:00:00Z');
const future = new Date('2026-06-25T13:00:00Z').toISOString(); // +1u
const past = new Date('2026-06-25T11:00:00Z').toISOString();   // -1u

test('inviteStatus: geldig zolang niet verlopen/ingetrokken/gebruikt', () => {
  assert.equal(inviteStatus({ expires_at: future }, NOW), 'valid');
});

test('inviteStatus: verlopen zodra expires_at gepasseerd is', () => {
  assert.equal(inviteStatus({ expires_at: past }, NOW), 'expired');
});

test('inviteStatus: precies óp de grens telt al als verlopen (<=)', () => {
  assert.equal(inviteStatus({ expires_at: NOW.toISOString() }, NOW), 'expired');
  // 1 ms vóór de grens is nog geldig
  assert.equal(inviteStatus({ expires_at: new Date(NOW.getTime() + 1).toISOString() }, NOW), 'valid');
});

test('inviteStatus: ingetrokken wint van verlopen', () => {
  assert.equal(inviteStatus({ expires_at: past, revoked_at: past }, NOW), 'revoked');
});

test('inviteStatus: geaccepteerd wint van verlopen, maar niet van ingetrokken', () => {
  assert.equal(inviteStatus({ expires_at: past, accepted_at: past }, NOW), 'accepted');
  assert.equal(inviteStatus({ accepted_at: past, revoked_at: past }, NOW), 'revoked');
});

test('inviteStatus: null/leeg → invalid', () => {
  assert.equal(inviteStatus(null, NOW), 'invalid');
  assert.equal(inviteStatus(undefined, NOW), 'invalid');
});

test('inviteStatus: ontbrekende expires_at → niet verlopen (valid)', () => {
  assert.equal(inviteStatus({}, NOW), 'valid');
});

test('inviteStatus: default now-param gebruikt de huidige tijd', () => {
  // Ruim in het verleden → altijd verlopen, ongeacht "nu"
  assert.equal(inviteStatus({ expires_at: '2000-01-01T00:00:00Z' }), 'expired');
  // Ruim in de toekomst → altijd geldig
  assert.equal(inviteStatus({ expires_at: '2999-01-01T00:00:00Z' }), 'valid');
});

test('isRedeemable: alleen valid is inwisselbaar', () => {
  assert.equal(isRedeemable({ expires_at: future }, NOW), true);
  assert.equal(isRedeemable({ expires_at: past }, NOW), false);
  assert.equal(isRedeemable({ expires_at: future, revoked_at: past }, NOW), false);
  assert.equal(isRedeemable(null, NOW), false);
});

test('isRedeemable: default now-param', () => {
  assert.equal(isRedeemable({ expires_at: '2999-01-01T00:00:00Z' }), true);
  assert.equal(isRedeemable({ expires_at: '2000-01-01T00:00:00Z' }), false);
});

test('hoursUntilExpiry: afgerond aantal hele uren tot verloop', () => {
  assert.equal(hoursUntilExpiry({ expires_at: new Date(NOW.getTime() + 2 * 3600000).toISOString() }, NOW), 2);
  assert.equal(hoursUntilExpiry({ expires_at: new Date(NOW.getTime() + 90 * 60000).toISOString() }, NOW), 2); // 1,5u → 2
});

test('hoursUntilExpiry: nooit negatief; verlopen → 0', () => {
  assert.equal(hoursUntilExpiry({ expires_at: past }, NOW), 0);
});

test('hoursUntilExpiry: ontbrekende invite/expires_at → 0', () => {
  assert.equal(hoursUntilExpiry(null, NOW), 0);
  assert.equal(hoursUntilExpiry({}, NOW), 0);
});

test('hoursUntilExpiry: default now-param', () => {
  assert.equal(hoursUntilExpiry({ expires_at: '2000-01-01T00:00:00Z' }), 0);
});

test('WEB_BASE_URL is de productie-web-host', () => {
  assert.equal(WEB_BASE_URL, 'https://huishoek.app');
});

test('inviteUrl: bouwt /join/<token> op de gegeven basis', () => {
  assert.equal(inviteUrl('abc', 'https://huishoek.app'), 'https://huishoek.app/join/abc');
});

test('inviteUrl: ontbrekend token → leeg token-segment (geen "undefined")', () => {
  assert.equal(inviteUrl(undefined, 'https://h.app'), 'https://h.app/join/');
  assert.equal(inviteUrl(null, 'https://h.app'), 'https://h.app/join/');
});

test('inviteUrl: strip trailing slashes van de basis', () => {
  assert.equal(inviteUrl('abc', 'https://example.com///'), 'https://example.com/join/abc');
});

test('inviteUrl: default basis is WEB_BASE_URL', () => {
  assert.equal(inviteUrl('abc'), `${WEB_BASE_URL}/join/abc`);
  assert.ok(inviteUrl('abc').startsWith(WEB_BASE_URL));
});

test('inviteUrl: lege basis valt terug op WEB_BASE_URL', () => {
  assert.equal(inviteUrl('xyz', ''), `${WEB_BASE_URL}/join/xyz`);
});

test('inviteUrl: URL-encodet het token', () => {
  assert.equal(inviteUrl('a b/c', 'https://h.app'), 'https://h.app/join/a%20b%2Fc');
});

test('normalizeToken: ruw token blijft ongemoeid (na trim)', () => {
  assert.equal(normalizeToken('  deadbeef  '), 'deadbeef');
});

test('normalizeToken: haalt het token uit een volledige link', () => {
  assert.equal(normalizeToken('https://huishoek.app/join/deadbeef'), 'deadbeef');
});

test('normalizeToken: strip query en hash', () => {
  assert.equal(normalizeToken('https://huishoek.app/join/deadbeef?x=1#frag'), 'deadbeef');
  assert.equal(normalizeToken('deadbeef?ref=mail'), 'deadbeef');
});

test('normalizeToken: lege/onbruikbare invoer → lege string', () => {
  assert.equal(normalizeToken(''), '');
  assert.equal(normalizeToken(null), '');
  assert.equal(normalizeToken(undefined), '');
});

test('normalizeToken: trailing slash na het token', () => {
  assert.equal(normalizeToken('https://huishoek.app/join/deadbeef/'), 'deadbeef');
});

test('normalizeToken: alleen slashes na /join/ → lege string (geen rest-fallback)', () => {
  assert.equal(normalizeToken('https://huishoek.app/join////'), '');
});
