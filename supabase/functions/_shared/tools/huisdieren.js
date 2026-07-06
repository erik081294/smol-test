// @ts-check
// Tool-pack van de Huisdieren-module (assistent-skill-file, guidelines §1; AI-19 fase A).
// Vooralsnog alleen lezen: het dierenoverzicht met leeftijd, laatst gelogde gewicht en
// open verzorgingstaken. De write (logboek-regel voorstellen) volgt in fase B.
// Contract: zie taken.js. Bewust géén import van lib/petCare.js (extensieloze imports
// horen niet in de edge-bundel); de leeftijd-berekening hieronder is een dunne,
// tz-vaste spiegel van ageLabel.

import { throwOnError } from './helpers.js';

/**
 * Leesbare leeftijd uit een geboortedatum, puur op datum-strings (UTC — geen
 * tijdzone-verrassingen): "8 mnd" / "3 jaar". Ongeldig/ontbrekend → null.
 * Spiegel van lib/petCare.js ageLabel, compact voor de kaartregel.
 * @param {string|null|undefined} birthDate YYYY-MM-DD
 * @param {string} today YYYY-MM-DD (ctx.today)
 * @returns {string|null}
 */
export function petAgeLabel(birthDate, today) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today) || birthDate > today) return null;
  const [by, bm] = [Number(birthDate.slice(0, 4)), Number(birthDate.slice(5, 7))];
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  let months = (ty - by) * 12 + (tm - bm);
  if (today.slice(8, 10) < birthDate.slice(8, 10)) months -= 1; // maandgrens nog niet bereikt
  if (months < 0) return null;
  if (months < 12) return `${months} mnd`;
  return `${Math.floor(months / 12)} jaar`;
}

/**
 * Dieren + laatst gelogde gewicht + open verzorgingstaken → data + lijst.
 * @param {Array<{id:string, name:string, type?:string|null, species_label?:string|null, birth_date?:string|null}>} [pets]
 * @param {Array<{pet_id?:string|null, weight_grams?:number|null, created_at?:string|null}>} [logs] gewicht-logs, nieuwste eerst
 * @param {Array<{pet_id?:string|null}>} [openTasks] open verzorgingstaken
 * @param {string} [today] YYYY-MM-DD voor de leeftijd
 */
export function renderPetsOverview(pets = [], logs = [], openTasks = [], today = '') {
  const weightByPet = /** @type {Record<string, number>} */ ({});
  for (const l of logs) {
    // Nieuwste eerst aangeleverd: de eerste treffer per dier wint.
    if (l?.pet_id && Number.isFinite(l.weight_grams) && /** @type {number} */ (l.weight_grams) > 0 && !(l.pet_id in weightByPet)) {
      weightByPet[l.pet_id] = /** @type {number} */ (l.weight_grams);
    }
  }
  const openByPet = /** @type {Record<string, number>} */ ({});
  for (const t of openTasks) {
    if (t?.pet_id) openByPet[t.pet_id] = (openByPet[t.pet_id] ?? 0) + 1;
  }
  const entries = pets.map((p) => ({
    name: p.name,
    type: (p.species_label && p.species_label.trim()) || p.type || 'anders',
    age: petAgeLabel(p.birth_date, today),
    weight_grams: weightByPet[p.id] ?? null,
    open_care_tasks: openByPet[p.id] ?? 0,
  }));
  const data = { count: pets.length, pets: entries };
  if (entries.length === 0) {
    return { data, render: [{ type: 'card', title: 'Huisdieren', lines: ['Er staan nog geen huisdieren in de app.'] }] };
  }
  const items = entries.map((e) => {
    const parts = [e.type, e.age, e.weight_grams ? `${(e.weight_grams / 1000).toFixed(1).replace('.', ',')} kg` : null,
      e.open_care_tasks > 0 ? `${e.open_care_tasks} open ${e.open_care_tasks === 1 ? 'taak' : 'taken'}` : null].filter(Boolean);
    return { text: `${e.name} — ${parts.join(' · ')}`, emoji: '🐾' };
  });
  return { data, render: [{ type: 'list', title: `Huisdieren (${entries.length})`, items }] };
}

// Module-brief (guidelines §1).
export const HUISDIEREN_BRIEF = {
  moduleKey: 'huisdieren',
  label: 'Huisdieren',
  brief: 'de huisdieren en hun verzorging; kan het dierenoverzicht en open verzorgingstaken tonen',
};

export const HUISDIEREN_TOOLS = [
  {
    name: 'huisdieren_overzicht',
    moduleKey: 'huisdieren',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Even bij de dieren kijken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt naar de huisdieren, hun leeftijd of gewicht, of welke dierverzorging er openstaat. Toont alle huisdieren met soort, leeftijd, laatst gelogde gewicht en het aantal open verzorgingstaken.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    async run(ctx) {
      const [pets, logs, tasks] = await Promise.all([
        ctx.db.from('pets').select('id, name, type, species_label, birth_date').eq('household_id', ctx.householdId).order('name').limit(50),
        ctx.db.from('pet_log').select('pet_id, weight_grams, created_at')
          .not('weight_grams', 'is', null).order('created_at', { ascending: false }).limit(100),
        ctx.db.from('tasks').select('pet_id')
          .eq('household_id', ctx.householdId).eq('category', 'huisdier').is('completed_at', null)
          .not('pet_id', 'is', null).limit(200),
      ]);
      return renderPetsOverview(throwOnError(pets), throwOnError(logs), throwOnError(tasks), ctx.today);
    },
  },
];

// Manifest: de enige declaratie per module (guidelines §1).
export const HUISDIEREN_MANIFEST = {
  moduleKey: HUISDIEREN_BRIEF.moduleKey,
  label: HUISDIEREN_BRIEF.label,
  brief: HUISDIEREN_BRIEF.brief,
  tools: HUISDIEREN_TOOLS,
};
