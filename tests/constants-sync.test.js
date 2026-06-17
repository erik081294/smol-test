// Bewaakt dat lib/constants.js in sync blijft met de CHECK-constraints in de
// database-migratie. De DB is de autoriteit; deze test faalt zodra de app-
// constants ervan afdrijven (bijv. een categorie toevoegen in SQL maar niet hier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CATEGORIES, VISIBILITY_VALUES, RECUR_VALUES, ROLE } from '../lib/constants.js';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, '../supabase/migrations/0001_init.sql'), 'utf8');

// Haalt de in-lijst uit een  ... in ('a','b',...)  CHECK op. Pakt het eerste
// voorkomen ná het gegeven kolom-anker, zodat we de juiste CHECK te pakken hebben.
function checkValues(anchor) {
  const idx = sql.indexOf(anchor);
  assert.ok(idx !== -1, `anker niet gevonden in SQL: ${anchor}`);
  const m = sql.slice(idx).match(/in\s*\(([^)]*)\)/i);
  assert.ok(m, `geen in (...) gevonden na ${anchor}`);
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean).sort();
}

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
