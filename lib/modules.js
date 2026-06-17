// Eén registry van alle modules. Dit is het inplug-punt van het framework:
// een nieuwe module toevoegen betekent (1) hier een descriptor bijzetten,
// (2) een scherm onder app/(tabs)/<route>.js maken, en (3) de tabel via
// public.enable_module_rls('<table>') in een migratie aanzetten.
//
// kind:
//   'overview' — leest meerdere module-tabellen samen (bijv. Vandaag)
//   'data'     — een eigen module-tabel met het standaard zichtbaarheidscontract
//   'admin'    — beheer (huishouden, leden, groepen), geen module-tabel
//
// De volgorde hier is de volgorde van de tabbalk.
export const MODULES = [
  { key: 'vandaag', label: 'Vandaag', emoji: '☀️', route: 'vandaag', kind: 'overview', table: null },
  { key: 'taken', label: 'Taken', emoji: '✅', route: 'taken', kind: 'data', table: 'tasks', creatorColumn: 'created_by' },
  { key: 'boodschappen', label: 'Boodschappen', emoji: '🛒', route: 'boodschappen', kind: 'data', table: 'groceries', creatorColumn: 'added_by' },
  { key: 'huishouden', label: 'Huishouden', emoji: '🏡', route: 'huishouden', kind: 'admin', table: null },
];

// Alleen de modules met een eigen tabel (handig voor tests/overzichten).
export const DATA_MODULES = MODULES.filter((m) => m.kind === 'data');

export const getModule = (key) => MODULES.find((m) => m.key === key) ?? null;
