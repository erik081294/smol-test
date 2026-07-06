// Units voor de pure filterkern van de tijdlijn (TML-6). Zie lib/timelineFilter.js.
// De regels die vast moeten staan: DEFAULT-ON, huishouden-uitzetting wint (een lid
// kan 'm niet terugzetten), en per as alleen de items die die as dragen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  visibleOnTimeline, disabledByAxis, moduleForEventType,
  EVENT_TYPE_MODULE, TIMELINE_EVENT_TYPES, TIMELINE_FILTER_MODULES, TIMELINE_FILTER_AXES,
} from '../lib/timelineFilter.js';

// ── visibleOnTimeline ────────────────────────────────────────────────────────

test('visibleOnTimeline: DEFAULT-ON — zonder config is alles zichtbaar (default-param)', () => {
  const event = { module: 'kosten', eventType: 'expense_added' };
  assert.equal(visibleOnTimeline(event), true);          // helemaal geen config
  assert.equal(visibleOnTimeline(event, {}), true);       // lege config
  assert.equal(visibleOnTimeline(event, { householdDisabled: {}, userDisabled: {} }), true);
});

test('visibleOnTimeline: huishouden-uitzetting op de module-as verbergt (gebruiker kan niet terugzetten)', () => {
  const event = { module: 'boodschappen', eventType: 'grocery_added' };
  // Huishouden uit, gebruiker heeft níéts uitgezet → tóch verborgen: er bestaat
  // geen "gebruiker zet terug aan"-pad, dus de huishouden-uitzetting wint vanzelf.
  assert.equal(
    visibleOnTimeline(event, { householdDisabled: { module: ['boodschappen'] }, userDisabled: {} }),
    false,
  );
  // En de grens: een ándere module in de lijst raakt dit item niet.
  assert.equal(
    visibleOnTimeline(event, { householdDisabled: { module: ['kosten'] } }),
    true,
  );
});

test('visibleOnTimeline: gebruikers-uitzetting verbergt óók (verfijnen binnen de basis)', () => {
  const event = { module: 'taken', eventType: 'task_completed' };
  assert.equal(visibleOnTimeline(event, { userDisabled: { module: ['taken'] } }), false);
  assert.equal(visibleOnTimeline(event, { userDisabled: { event_type: ['task_completed'] } }), false);
});

test('visibleOnTimeline: event_type-as raakt alleen het exacte type (grenswaarde)', () => {
  const cfg = { householdDisabled: { event_type: ['grocery_added'] } };
  assert.equal(visibleOnTimeline({ module: 'boodschappen', eventType: 'grocery_added' }, cfg), false);
  // Zelfde module, ander event-type → blijft zichtbaar (de module-as is niet uitgezet).
  assert.equal(visibleOnTimeline({ module: 'kosten', eventType: 'expense_added' }, cfg), true);
});

test('visibleOnTimeline: een bericht (geen eventType) valt niet onder de event_type-as', () => {
  // Handgeschreven post: draagt geen eventType, dus event_type-uitzettingen raken 'm niet.
  const post = { module: 'tijdlijn' };
  assert.equal(visibleOnTimeline(post, { householdDisabled: { event_type: ['task_completed'] } }), true);
  // Maar de module-as werkt wél op wat het item draagt.
  assert.equal(visibleOnTimeline(post, { userDisabled: { module: ['tijdlijn'] } }), false);
});

test('visibleOnTimeline: null-paden — leeg item of kapotte lijsten → default-on', () => {
  assert.equal(visibleOnTimeline(), true);                      // geen item
  assert.equal(visibleOnTimeline(null), true);                  // expliciet null
  assert.equal(visibleOnTimeline({}), true);                    // item zonder assen
  // Een as met iets anders dan een array (kapotte config) telt als "geen uitzetting".
  assert.equal(
    visibleOnTimeline({ module: 'kosten' }, { householdDisabled: { module: 'kosten' } }),
    true,
  );
});

// ── disabledByAxis ───────────────────────────────────────────────────────────

test('disabledByAxis: groepeert alleen enabled=false-rijen per as', () => {
  const rows = [
    { axis: 'module', value: 'kosten', enabled: false },
    { axis: 'module', value: 'taken', enabled: true },        // expliciet aan → telt niet
    { axis: 'event_type', value: 'grocery_added', enabled: false },
    { axis: 'module', value: 'planten', enabled: false },
  ];
  assert.deepEqual(disabledByAxis(rows), {
    module: ['kosten', 'planten'],
    event_type: ['grocery_added'],
  });
});

test('disabledByAxis: kapotte rijen worden overgeslagen; zonder argument → leeg (default-param)', () => {
  const rows = [
    null,                                            // hele rij null → geen crash
    { axis: 'module', enabled: false },              // value ontbreekt
    { value: 'kosten', enabled: false },             // axis ontbreekt
    { axis: 5, value: 'x', enabled: false },         // axis geen string
    { axis: 'module', value: 'kosten' },             // enabled ontbreekt (≠ false) → default-on
  ];
  assert.deepEqual(disabledByAxis(rows), {});
  assert.deepEqual(disabledByAxis(), {});
  assert.deepEqual(disabledByAxis([]), {});
});

// ── event-type ↔ module-koppeling ────────────────────────────────────────────

test('moduleForEventType: elk feed-event-type wijst naar zijn module (hele tabel)', () => {
  // Assert de volledige mapping: dit is de datatabel waarop de module-as leunt.
  assert.equal(moduleForEventType('task_completed'), 'taken');
  assert.equal(moduleForEventType('expense_added'), 'kosten');
  assert.equal(moduleForEventType('grocery_added'), 'boodschappen');
  assert.equal(moduleForEventType('plant_added'), 'planten');
  assert.equal(moduleForEventType('pet_added'), 'huisdieren');
  assert.equal(moduleForEventType('vehicle_added'), 'voertuigen');
  assert.equal(moduleForEventType('bestaat_niet'), undefined);
  assert.equal(moduleForEventType(), undefined);
});

test('afgeleide lijsten: event-types en modules dekken exact de mapping (volgorde vast)', () => {
  assert.deepEqual(TIMELINE_EVENT_TYPES, Object.keys(EVENT_TYPE_MODULE));
  assert.deepEqual(TIMELINE_FILTER_MODULES,
    ['taken', 'kosten', 'boodschappen', 'planten', 'huisdieren', 'voertuigen']);
  // De vier assen uit het ontwerp — moet 1-op-1 sporen met het CHECK in migratie 0076.
  assert.deepEqual(TIMELINE_FILTER_AXES, ['module', 'event_type', 'member', 'subgroup']);
});
