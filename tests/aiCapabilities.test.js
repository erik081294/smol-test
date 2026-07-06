// Unit-tests voor de pure capability-policy (lib/aiCapabilities.js, B4). Focus per
// CLAUDE.md-mutantenpatronen: exacte risk→capability-afleiding, default-on met
// intrekking-precedentie, en de reads-mogen-altijd-grens.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CAPABILITIES,
  requiredCapabilities,
  grantedCapabilities,
  canUseTool,
} from '../lib/aiCapabilities.js';

const sorted = (set) => [...set].sort();

test('AI_CAPABILITIES: de instelbare set ligt vast (voedt de beheer-UI en de policy)', () => {
  assert.deepEqual(AI_CAPABILITIES, ['ai:write', 'ai:spend', 'ai:destructive']);
});

test('requiredCapabilities: elke risk-tier mapt naar exact de juiste capabilities', () => {
  assert.deepEqual(requiredCapabilities({ kind: 'read', risk: 'read' }), []);
  assert.deepEqual(requiredCapabilities({ kind: 'write', risk: 'write' }), ['ai:write']);
  assert.deepEqual(requiredCapabilities({ kind: 'write', risk: 'financial' }), ['ai:write', 'ai:spend']);
  assert.deepEqual(requiredCapabilities({ kind: 'write', risk: 'destructive' }), ['ai:write', 'ai:destructive']);
});

test('requiredCapabilities: een write zonder (bekende) risk valt veilig terug op ai:write', () => {
  assert.deepEqual(requiredCapabilities({ kind: 'write' }), ['ai:write']);
  assert.deepEqual(requiredCapabilities({ kind: 'write', risk: 'onzin' }), ['ai:write']);
});

test('requiredCapabilities: geen tool / read → geen eis (reads mogen altijd)', () => {
  assert.deepEqual(requiredCapabilities(), []);
  assert.deepEqual(requiredCapabilities(null), []);
  assert.deepEqual(requiredCapabilities({ kind: 'read' }), []);
});

test('grantedCapabilities: default-on — zonder intrekkingen is alles verleend', () => {
  assert.deepEqual(sorted(grantedCapabilities()), sorted(new Set(AI_CAPABILITIES)));
  assert.deepEqual(sorted(grantedCapabilities({})), sorted(new Set(AI_CAPABILITIES)));
});

test('grantedCapabilities: een intrekking (huishouden óf gebruiker) haalt de capability weg', () => {
  assert.deepEqual(sorted(grantedCapabilities({ householdRevoked: ['ai:spend'] })), ['ai:destructive', 'ai:write']);
  assert.deepEqual(sorted(grantedCapabilities({ userRevoked: ['ai:write'] })), ['ai:destructive', 'ai:spend']);
});

test('grantedCapabilities: huishouden- én gebruiker-intrekkingen tellen samen; onbekende sleutels negeren', () => {
  // Huishouden trekt spend in, gebruiker trekt destructive in → alleen write blijft.
  assert.deepEqual(
    sorted(grantedCapabilities({ householdRevoked: ['ai:spend'], userRevoked: ['ai:destructive'] })),
    ['ai:write']
  );
  // Een sleutel die geen bestaande capability is verandert niets.
  assert.deepEqual(sorted(grantedCapabilities({ userRevoked: ['ai:onbekend'] })), sorted(new Set(AI_CAPABILITIES)));
});

test('canUseTool: reads mogen altijd, óók met een lege verleende set', () => {
  assert.equal(canUseTool({ kind: 'read', risk: 'read' }, new Set()), true);
  assert.equal(canUseTool({ kind: 'read' }), true); // default granted = leeg → read mag toch
});

test('canUseTool: een write vereist ai:write; ontbreekt die → geweigerd', () => {
  const write = { kind: 'write', risk: 'write' };
  assert.equal(canUseTool(write, new Set(['ai:write'])), true);
  assert.equal(canUseTool(write, new Set(['ai:spend', 'ai:destructive'])), false); // wel spend/destructive, geen write
  assert.equal(canUseTool(write, new Set()), false);
  assert.equal(canUseTool(write), false); // default granted = leeg
});

test('canUseTool: financiële/destructieve writes eisen de extra capability bovenop ai:write', () => {
  const fin = { kind: 'write', risk: 'financial' };
  assert.equal(canUseTool(fin, new Set(['ai:write', 'ai:spend'])), true);
  assert.equal(canUseTool(fin, new Set(['ai:write'])), false); // write alleen is niet genoeg
  const del = { kind: 'write', risk: 'destructive' };
  assert.equal(canUseTool(del, new Set(['ai:write', 'ai:destructive'])), true);
  assert.equal(canUseTool(del, new Set(['ai:write'])), false);
});

test('canUseTool: accepteert ook een array als verleende set (niet alleen een Set)', () => {
  assert.equal(canUseTool({ kind: 'write', risk: 'write' }, ['ai:write']), true);
  assert.equal(canUseTool({ kind: 'write', risk: 'write' }, []), false);
});

test('canUseTool: end-to-end met grantedCapabilities — owner zet ai:spend uit voor een kind', () => {
  const granted = grantedCapabilities({ householdRevoked: ['ai:spend'] });
  assert.equal(canUseTool({ kind: 'read', risk: 'read' }, granted), true);          // lezen mag
  assert.equal(canUseTool({ kind: 'write', risk: 'write' }, granted), true);        // gewone write mag
  assert.equal(canUseTool({ kind: 'write', risk: 'financial' }, granted), false);   // geld boeken niet
});
