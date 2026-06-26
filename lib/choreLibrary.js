// @ts-check
// Klus-bibliotheek (KLU-2) + seizoenssuggesties (KLU-3). Pure, regelgebaseerde
// data: een vaste lijst veelvoorkomende klussen met een standaard-interval, zodat
// je ze met één tik toevoegt i.p.v. ze elke keer uit te typen. Géén React/Supabase
// hier — een klus omzetten naar een task-payload is volledig te unit-testen.
//
// Een bibliotheek-klus wordt een gewone task: hij volgt exact het tasks-schema
// (category matcht de CHECK uit 0001, recur_* volgt de herhaalvelden), zodat de
// bestaande recurrence-, toewijzings- en zichtbaarheidslogica hem afhandelt. Er is
// dus géén nieuwe tabel of migratie nodig.
import { format } from 'date-fns';
import { RECUR, VISIBILITY, CATEGORIES } from './constants';

// De bibliotheek. Bewust een kleine, herkenbare set; uit te breiden zonder
// code-wijziging elders.
//   group        : kop waaronder de klus in de UI valt.
//   recur_freq   : null = eenmalig; anders volgt het tasks-schema.
//   months       : (1=jan .. 12=dec) seizoensklussen (KLU-3) — alleen voorgesteld
//                  in die maanden. Klussen zónder months zijn het hele jaar relevant.
export const CHORE_LIBRARY = [
  // --- Veiligheid -----------------------------------------------------------
  { key: 'rookmelder',  group: 'Veiligheid', emoji: '🔔', title: 'Rookmelder testen',     category: 'klus', recur_freq: RECUR.MONTHLY, recur_interval: 1, notes: 'Testknop ingedrukt houden tot de melder piept.' },
  { key: 'co-melder',   group: 'Veiligheid', emoji: '🟩', title: 'CO-melder testen',       category: 'klus', recur_freq: RECUR.MONTHLY, recur_interval: 1 },
  { key: 'cv-druk',     group: 'Veiligheid', emoji: '🌡️', title: 'CV-waterdruk checken',   category: 'klus', recur_freq: RECUR.MONTHLY, recur_interval: 1, notes: 'Onder 1,5 bar? Bijvullen tot ±1,8 bar.' },

  // --- Onderhoud ------------------------------------------------------------
  { key: 'waterkoker',  group: 'Onderhoud', emoji: '💧', title: 'Waterkoker ontkalken',        category: 'huishouden', recur_freq: RECUR.MONTHLY, recur_interval: 2 },
  { key: 'koffie',      group: 'Onderhoud', emoji: '☕', title: 'Koffiezetapparaat ontkalken', category: 'huishouden', recur_freq: RECUR.MONTHLY, recur_interval: 2 },
  { key: 'wasmachine',  group: 'Onderhoud', emoji: '🧼', title: 'Wasmachine reinigen',         category: 'huishouden', recur_freq: RECUR.MONTHLY, recur_interval: 3, notes: 'Heet programma met wasmachinereiniger, leeg.' },
  { key: 'afvoer',      group: 'Onderhoud', emoji: '🚰', title: 'Afvoeren doorspoelen',        category: 'huishouden', recur_freq: RECUR.MONTHLY, recur_interval: 3 },
  { key: 'filters',     group: 'Onderhoud', emoji: '🌀', title: 'Afzuigkap-filter reinigen',   category: 'huishouden', recur_freq: RECUR.MONTHLY, recur_interval: 2 },

  // --- Seizoen (KLU-3) ------------------------------------------------------
  { key: 'zonnescherm', group: 'Seizoen', emoji: '⛱️', title: 'Zonnescherm nalopen',         category: 'klus', months: [3, 4],   notes: 'Schoonmaken en op beschadigingen controleren.' },
  { key: 'tuin-klaar',  group: 'Seizoen', emoji: '🌱', title: 'Tuin voorjaarsklaar maken',   category: 'klus', months: [3, 4] },
  { key: 'dakgoot',     group: 'Seizoen', emoji: '🍂', title: 'Dakgoot schoonmaken',         category: 'klus', months: [4, 10], notes: 'Bladeren en mos weghalen, voor- en najaar.' },
  { key: 'cv-onderhoud',group: 'Seizoen', emoji: '🔧', title: 'CV-ketel onderhoud plannen',  category: 'klus', months: [9, 10], notes: 'Vóór het stookseizoen een beurt inplannen.' },
  { key: 'tuinslang',   group: 'Seizoen', emoji: '🚿', title: 'Tuinslang aftappen',          category: 'klus', months: [11],    notes: 'Vóór de vorst, anders bevriest het water.' },
  { key: 'tochtstrips', group: 'Seizoen', emoji: '🪟', title: 'Tochtstrips controleren',     category: 'klus', months: [10, 11] },
];

// Veilig falen bij ontwikkelfouten: elke klus moet een geldige category dragen,
// anders weigert de DB-CHECK de insert. Hier vroeg zichtbaar i.p.v. pas runtime.
for (const c of CHORE_LIBRARY) {
  if (!CATEGORIES.includes(c.category)) {
    throw new Error(`choreLibrary: onbekende category '${c.category}' voor '${c.key}'`);
  }
}

export const getChore = (key) => CHORE_LIBRARY.find((c) => c.key === key) ?? null;

// Klussen die het hele jaar relevant zijn (geen seizoensgebondenheid): de vaste
// bibliotheek. Behoudt de volgorde uit CHORE_LIBRARY.
export const yearRoundChores = (library = CHORE_LIBRARY) =>
  library.filter((c) => !Array.isArray(c.months) || c.months.length === 0);

// Seizoenssuggesties (KLU-3): de klussen die in deze maand (1=jan .. 12=dec)
// passen. Een klus verschijnt zodra de maand in zijn months-lijst zit.
export const seasonalChores = (month, library = CHORE_LIBRARY) =>
  library.filter((c) => Array.isArray(c.months) && c.months.includes(month));

// Groepeer de jaar-rond-klussen op hun `group`, in de volgorde waarin de groepen
// voor het eerst voorkomen. Geeft [{ group, chores: [...] }] voor de UI.
export function groupedChores(library = CHORE_LIBRARY) {
  const order = [];
  const byGroup = new Map();
  for (const c of yearRoundChores(library)) {
    if (!byGroup.has(c.group)) { byGroup.set(c.group, []); order.push(c.group); }
    byGroup.get(c.group).push(c);
  }
  return order.map((group) => ({ group, chores: byGroup.get(group) }));
}

// Zet een bibliotheek-klus om naar een task-payload (zonder household_id/creator —
// die voegt useCollection.create toe). startDate wordt de vervaldatum; een
// terugkerende klus heeft een datum nodig om door te kunnen rollen.
export function choreToTask(chore, { startDate = new Date() } = {}) {
  const recurring = !!chore.recur_freq;
  return {
    title: chore.title,
    notes: chore.notes ?? null,
    category: chore.category,
    due_date: format(startDate, 'yyyy-MM-dd'),
    recur_freq: chore.recur_freq ?? null,
    recur_interval: recurring ? (chore.recur_interval ?? 1) : 1,
    recur_weekdays: null,
    ...visibilityFields(),
  };
}

// Bibliotheek-klussen zijn standaard voor het hele huishouden zichtbaar. Apart
// gehouden zodat de payload-vorm bij de andere modules aansluit (visibilityPayload),
// zonder hier React/Supabase te importeren.
function visibilityFields() {
  return {
    visibility: VISIBILITY.HOUSEHOLD,
    share_subgroup_id: null,
    share_with: null,
  };
}
