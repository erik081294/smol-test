// Units voor de i18n-laag (lib/i18n.js). De laag moet drie dingen waarmaken:
// bestaande sleutels vertalen, ontbrekende sleutels zichtbaar laten vallen
// (nooit crashen), en {vars} invullen — plus taal schakelen en simpel pluraal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, setLang, getLang, registerDict, plural } from '../lib/i18n.js';

test('t vindt een bestaande NL-sleutel', () => {
  assert.equal(t('common.cancel'), 'Annuleer');
  assert.equal(t('tasks.title'), 'Taken');
});

test('t valt terug op de sleutel zelf bij een ontbrekende vertaling', () => {
  assert.equal(t('does.not.exist'), 'does.not.exist');
});

test('t valt terug op de default-taal (nl) als de actieve taal de sleutel mist', () => {
  registerDict('en', { 'common.cancel': 'Cancel' }); // en kent enkel deze sleutel
  setLang('en');
  assert.equal(t('common.cancel'), 'Cancel');        // en-vertaling wint
  assert.equal(t('tasks.title'), 'Taken');           // ontbreekt in en → nl-fallback, niet de kale sleutel
  assert.equal(t('really.absent.key'), 'really.absent.key'); // ook nl mist 'm → kale sleutel
  setLang('nl');                                      // terug voor de overige tests
});

test('t vult {vars}-placeholders in', () => {
  registerDict('nl', { 'test.greet': 'Hoi {naam}, je hebt {n} taken' });
  assert.equal(t('test.greet', { naam: 'Tim', n: 3 }), 'Hoi Tim, je hebt 3 taken');
});

test('t laat onbekende placeholders ongemoeid staan', () => {
  registerDict('nl', { 'test.partial': 'Hoi {naam}, {onbekend}' });
  assert.equal(t('test.partial', { naam: 'Tim' }), 'Hoi Tim, {onbekend}');
});

test('setLang schakelt naar een geregistreerde taal en negeert onbekende', () => {
  registerDict('en', { 'common.cancel': 'Cancel' });
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('common.cancel'), 'Cancel');
  setLang('zz'); // onbekend → blijft staan
  assert.equal(getLang(), 'en');
  setLang('nl'); // terug voor andere tests
  assert.equal(t('common.cancel'), 'Annuleer');
});

test('plural kiest één- vs meer-sleutel en geeft {n} door', () => {
  registerDict('nl', {
    'test.participants.one': '{n} deelnemer',
    'test.participants.other': '{n} deelnemers',
  });
  assert.equal(plural(1, 'test.participants.one', 'test.participants.other'), '1 deelnemer');
  assert.equal(plural(3, 'test.participants.one', 'test.participants.other'), '3 deelnemers');
});
