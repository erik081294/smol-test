// Unit-tests voor de pure edge-Sentry-kern (INF-4): DSN-parse en de store-URL/-event-
// compositie exact gepind. De Deno-schil (supabase/functions/_shared/sentry.ts) is
// dunne fail-silent glue en valt buiten node:test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDsn, storeUrl, eventMessage, buildStoreEvent, MAX_MESSAGE_CHARS } from '../supabase/functions/_shared/sentryCore.js';

// Representatieve SaaS-DSN (EU-region, zoals evdn/huishoek op de.sentry.io).
const DSN = 'https://abc123def456@o450000.ingest.de.sentry.io/4509876543210';

test('parseDsn: geldige DSN → exact { host, projectId, publicKey }', () => {
  assert.deepEqual(parseDsn(DSN), {
    host: 'o450000.ingest.de.sentry.io',
    projectId: '4509876543210',
    publicKey: 'abc123def456',
  });
});

test('parseDsn: witruimte eromheen wordt getrimd', () => {
  assert.deepEqual(parseDsn(`  ${DSN}\n`), parseDsn(DSN));
});

test('parseDsn: projectId is het laatste pad-segment (ook met trailing slash)', () => {
  assert.deepEqual(parseDsn('https://key@sentry.example.com/99/'), {
    host: 'sentry.example.com',
    projectId: '99',
    publicKey: 'key',
  });
});

test('parseDsn: onbruikbare invoer → null (no-op voor de aanroeper)', () => {
  assert.equal(parseDsn(), null); // env ontbreekt (undefined)
  assert.equal(parseDsn(''), null);
  assert.equal(parseDsn('   '), null);
  assert.equal(parseDsn(42), null); // geen string
  assert.equal(parseDsn('geen-url'), null);
  assert.equal(parseDsn('https://host.sentry.io/123'), null); // geen publicKey
  assert.equal(parseDsn('https://key@host.sentry.io/'), null); // geen projectId
  assert.equal(parseDsn('https://key@host.sentry.io/abc'), null); // projectId niet numeriek
  assert.equal(parseDsn('https://key@host.sentry.io/v123'), null); // VOLLEDIG numeriek vereist (^-anker)
  assert.equal(parseDsn('https://key@host.sentry.io/123abc'), null); // idem ($-anker)
});

test('storeUrl: exacte store-endpoint-compositie (auth via query-string)', () => {
  const parsed = parseDsn(DSN);
  assert.ok(parsed);
  assert.equal(
    storeUrl(parsed),
    'https://o450000.ingest.de.sentry.io/api/4509876543210/store/?sentry_version=7&sentry_key=abc123def456',
  );
});

test('eventMessage: label + fout; zonder fout alleen het (getrimde) label', () => {
  assert.equal(eventMessage('Orq onbereikbaar', new Error('boem')), 'Orq onbereikbaar: Error: boem');
  assert.equal(eventMessage('Orq onbereikbaar'), 'Orq onbereikbaar');
  assert.equal(eventMessage('  rate-limit faalde  ', null), 'rate-limit faalde');
  assert.equal(eventMessage(), '');
});

test('eventMessage: geklemd op MAX_MESSAGE_CHARS (geen payload-dumps)', () => {
  const clamped = eventMessage('label', 'y'.repeat(MAX_MESSAGE_CHARS + 100));
  assert.equal(clamped.length, MAX_MESSAGE_CHARS);
  assert.ok(clamped.startsWith('label: yyy'));
  assert.equal(eventMessage('x'.repeat(MAX_MESSAGE_CHARS + 10)).length, MAX_MESSAGE_CHARS);
});

test('buildStoreEvent: exacte minimale event-vorm', () => {
  assert.deepEqual(
    buildStoreEvent({
      message: 'assistant: Orq-fout',
      level: 'warning',
      tags: { function: 'assistant', stage: 'orq' },
      timestamp: '2026-07-07T12:00:00.000Z',
    }),
    {
      message: 'assistant: Orq-fout',
      level: 'warning',
      platform: 'javascript',
      timestamp: '2026-07-07T12:00:00.000Z',
      tags: { function: 'assistant', stage: 'orq' },
    },
  );
});

test('buildStoreEvent: defaults — level error, lege tags, géén timestamp-veld', () => {
  assert.deepEqual(buildStoreEvent({ message: 'x' }), {
    message: 'x',
    level: 'error',
    platform: 'javascript',
    tags: {},
  });
});

test('buildStoreEvent: zonder argument → zelfde neutrale event, message altijd string', () => {
  assert.deepEqual(buildStoreEvent(), { message: '', level: 'error', platform: 'javascript', tags: {} });
  assert.equal(buildStoreEvent({ message: 12 }).message, '12');
  assert.equal(buildStoreEvent({ message: 'a'.repeat(MAX_MESSAGE_CHARS + 5) }).message.length, MAX_MESSAGE_CHARS);
});
