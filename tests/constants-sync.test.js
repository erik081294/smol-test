// Bewaakt dat lib/constants.js in sync blijft met de CHECK-constraints in de
// database-migratie. De DB is de autoriteit; deze test faalt zodra de app-
// constants ervan afdrijven (bijv. een categorie toevoegen in SQL maar niet hier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CATEGORIES, VISIBILITY_VALUES, RECUR_VALUES, ROLE, MEAL_TYPES, PANTRY_LOCATIONS, EXPENSE_CATEGORIES, TAG_COLORS, STORE_LINKS } from '../lib/constants.js';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, '../supabase/migrations/0001_init.sql'), 'utf8');
const sql0016 = readFileSync(resolve(here, '../supabase/migrations/0016_maaltijden_voorraad.sql'), 'utf8');
const sql0019 = readFileSync(resolve(here, '../supabase/migrations/0019_kosten_inzichten.sql'), 'utf8');

// Haalt de in-lijst uit een  ... in ('a','b',...)  CHECK op. Pakt het eerste
// voorkomen ná het gegeven kolom-anker, zodat we de juiste CHECK te pakken hebben.
function checkValuesIn(source, anchor) {
  const idx = source.indexOf(anchor);
  assert.ok(idx !== -1, `anker niet gevonden in SQL: ${anchor}`);
  const m = source.slice(idx).match(/in\s*\(([^)]*)\)/i);
  assert.ok(m, `geen in (...) gevonden na ${anchor}`);
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
}
const checkValues = (anchor) => checkValuesIn(sql, anchor);

test('CATEGORIES matcht tasks.category CHECK', () => {
  assert.deepEqual([...CATEGORIES].sort(), checkValues('category      text not null'));
});

test('VISIBILITY_VALUES matcht tasks.visibility CHECK', () => {
  assert.deepEqual([...VISIBILITY_VALUES].sort(), checkValues('visibility    text not null'));
});

test('RECUR_VALUES matcht tasks.recur_freq CHECK', () => {
  assert.deepEqual([...RECUR_VALUES].sort(), checkValues('recur_freq    text check'));
});

test('ROLE matcht household_members.role CHECK', () => {
  assert.deepEqual(Object.values(ROLE).sort(), checkValues('role         text not null default'));
});

test('MEAL_TYPES matcht meal_plan_entries.meal_type CHECK (0016)', () => {
  assert.deepEqual([...MEAL_TYPES].sort(), checkValuesIn(sql0016, 'meal_type    text not null'));
});

test('PANTRY_LOCATIONS matcht pantry_items.location CHECK (0016)', () => {
  assert.deepEqual([...PANTRY_LOCATIONS].sort(), checkValuesIn(sql0016, "location           text not null default 'kast'"));
});

test('EXPENSE_CATEGORIES matcht expenses.category CHECK (0019)', () => {
  assert.deepEqual([...EXPENSE_CATEGORIES].sort(), checkValuesIn(sql0019, 'category text not null default'));
});

// TAG_COLORS (UX-41): het kleurenpalet voor zelfgemaakte tags. Géén DB-CHECK, maar
// wel een vaste vorm — pin de exacte set zodat de mutatietest de literals dekt en een
// per ongeluk leeggemaakt/aangepast palet meteen opvalt.
test('TAG_COLORS: vaste set distinct geldige hex-kleuren', () => {
  assert.deepEqual(TAG_COLORS, ['#E4572E', '#F3A712', '#2E933C', '#3A7CA5', '#7B4BC4', '#C2417B', '#5A6470']);
  assert.equal(TAG_COLORS.length, 7);
  assert.equal(new Set(TAG_COLORS).size, TAG_COLORS.length); // allemaal uniek
  for (const c of TAG_COLORS) assert.match(c, /^#[0-9A-Fa-f]{6}$/); // #RRGGBB
});

// STORE_LINKS (PLT-7): de download-links op het join-succes-scherm. Pin de vorm:
// beide platform-sleutels bestaan, en een waarde is óf null (nog geen store-listing →
// het scherm toont de niet-tikbare "binnenkort"-caption) óf een https-URL (→ tikbare
// badge). Het scherm leunt op precies dit onderscheid.
test('STORE_LINKS: ios/android aanwezig, waarde null of https-URL', () => {
  assert.deepEqual(Object.keys(STORE_LINKS).sort(), ['android', 'ios']);
  for (const [platform, url] of Object.entries(STORE_LINKS)) {
    assert.ok(url === null || /^https:\/\//.test(url), `${platform}: null of https-URL, kreeg ${url}`);
  }
});
