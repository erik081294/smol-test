// Units voor de gedeelde realtime-hub (lib/realtimeHub.js, INF-8). De hub bundelt alle
// hooks van één huishouden tot één kanaal en dedupliceert per (tabel, filter) — dit is
// de kern die de "hook-storm" op het Vandaag-scherm oplost. We drijven 'm met een fake
// Supabase-client + een handmatige scheduler zodat de rebuild-debounce deterministisch is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRealtimeHub } from '../lib/realtimeHub.js';

// Fake realtime-client: legt aangemaakte kanalen + hun listeners vast.
function makeFakeClient() {
  const channels = [];
  const removed = [];
  const client = {
    channel(topic) {
      const ch = {
        topic, subscribed: false, listeners: [],
        on(_type, opts, cb) { this.listeners.push({ opts, cb }); return this; },
        subscribe() { this.subscribed = true; return this; },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch) { removed.push(ch); },
  };
  return { client, channels, removed };
}

// Handmatige scheduler: verzamel geplande rebuilds en flush ze expliciet.
function makeScheduler() {
  let pending = [];
  return { schedule: (fn) => pending.push(fn), flush: () => { const p = pending; pending = []; p.forEach((fn) => fn()); } };
}

const setup = () => {
  const fake = makeFakeClient();
  const sched = makeScheduler();
  const hub = createRealtimeHub(fake.client, { schedule: sched.schedule });
  return { ...fake, ...sched, hub };
};

const live = (channels, removed) => channels.filter((c) => !removed.includes(c));

test('hub: bundelt de mount-burst tot één gesubscribed kanaal', () => {
  const { hub, channels, flush } = setup();
  hub.subscribe('hh', [{ table: 'tasks', filter: 'household_id=eq.hh', cb: () => {} }]);
  hub.subscribe('hh', [{ table: 'groceries', cb: () => {} }]);
  hub.subscribe('hh', [{ table: 'expenses', cb: () => {} }]);
  assert.equal(channels.length, 0); // gedebounced: nog niets gebouwd
  flush();
  assert.equal(channels.length, 1);
  assert.equal(channels[0].subscribed, true);
  assert.equal(channels[0].listeners.length, 3);
});

test('hub: dedupliceert per (tabel, filter) en fan-out\'t naar alle callbacks', () => {
  const { hub, channels, flush } = setup();
  const calls = [];
  hub.subscribe('hh', [{ table: 'groceries', filter: 'f', cb: () => calls.push('a') }]);
  hub.subscribe('hh', [{ table: 'groceries', filter: 'f', cb: () => calls.push('b') }]);
  flush();
  const ch = channels[channels.length - 1];
  const gl = ch.listeners.filter((l) => l.opts.table === 'groceries');
  assert.equal(gl.length, 1);              // één server-listener voor de gedeelde bron
  gl[0].cb({ event: 'x' });
  assert.deepEqual(calls, ['a', 'b']);     // beide hooks krijgen het event
});

test('hub: extra abonnee op een bestaande bron bouwt het kanaal NIET opnieuw', () => {
  const { hub, channels, removed, flush } = setup();
  hub.subscribe('hh', [{ table: 'tasks', cb: () => {} }]);
  flush();
  const built = channels.length;
  hub.subscribe('hh', [{ table: 'tasks', cb: () => {} }]); // zelfde bron
  flush();
  assert.equal(channels.length, built);    // geen rebuild
  assert.equal(removed.length, 0);
});

test('hub: een níéuwe bron bouwt het kanaal opnieuw (oude opgeruimd)', () => {
  const { hub, channels, removed, flush } = setup();
  hub.subscribe('hh', [{ table: 'tasks', cb: () => {} }]);
  flush();
  hub.subscribe('hh', [{ table: 'groceries', cb: () => {} }]);
  flush();
  assert.equal(removed.length, 1);         // oude kanaal afgebroken
  const ch = channels[channels.length - 1];
  assert.equal(ch.listeners.length, 2);    // nieuw kanaal met beide bronnen
});

test('hub: gedeeltelijk afmelden houdt de bron (geen rebuild); laatste afmelding sloopt', () => {
  const { hub, channels, removed, flush } = setup();
  const un1 = hub.subscribe('hh', [{ table: 'tasks', cb: () => {} }]);
  const un2 = hub.subscribe('hh', [{ table: 'tasks', cb: () => {} }]);
  flush();
  const built = channels.length;
  un1(); flush();
  assert.equal(channels.length, built);    // bron heeft nog een abonnee → niets rebuilt
  assert.equal(removed.length, 0);
  un2(); flush();
  assert.equal(removed.length, 1);         // laatste weg → kanaal opgeruimd
});

test('hub: kanalen zijn per key (huishouden) gescheiden', () => {
  const { hub, channels, flush } = setup();
  hub.subscribe('h1', [{ table: 'tasks', cb: () => {} }]);
  hub.subscribe('h2', [{ table: 'tasks', cb: () => {} }]);
  flush();
  assert.equal(live(channels, []).length, 2);
});

test('hub: lege/falsy invoer is een veilige no-op', () => {
  const { hub, channels, flush } = setup();
  const un = hub.subscribe(null, [{ table: 'tasks', cb: () => {} }]);
  hub.subscribe('hh', []);
  flush();
  assert.equal(channels.length, 0);
  assert.equal(typeof un, 'function');
  un(); // mag niet gooien
});
