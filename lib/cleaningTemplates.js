// @ts-check
// Pure, regelgebaseerde schoonmaakroosters. Géén React/Supabase: een sjabloon
// omzetten naar de aan te maken zones + taken is volledig te unit-testen.
//
// Een schoonmaaktaak is een gewone task: category 'huishouden' + zone_id. De
// terugkeer-velden (recur_freq/-interval/-weekdays) volgen exact het tasks-schema,
// zodat de bestaande recurrence-logica ze afhandelt. Weekdagen: 0=zo .. 6=za
// (zelfde conventie als lib/recurrence.js en tasks.recur_weekdays).
import { format, addDays } from 'date-fns';
import { RECUR, VISIBILITY } from './constants';

// De sjablonen. Bewust een kleine, herkenbare set; uit te breiden zonder code-wijziging
// elders. Per regel één terugkerende taak in een zone.
export const CLEANING_TEMPLATES = [
  {
    key: 'standaard-week',
    label: 'Standaard weekschema',
    description: 'Een basisritme voor een doorsnee huishouden.',
    rooms: [
      { zone: 'Badkamer',  emoji: '🛁', title: 'Badkamer schoonmaken', recur_freq: RECUR.WEEKLY,  recur_interval: 1, recur_weekdays: [6] }, // za
      { zone: 'Keuken',    emoji: '🍳', title: 'Keuken dweilen',        recur_freq: RECUR.WEEKLY,  recur_interval: 1, recur_weekdays: [0] }, // zo
      { zone: 'Woonkamer', emoji: '🛋️', title: 'Stofzuigen',            recur_freq: RECUR.WEEKLY,  recur_interval: 1, recur_weekdays: [3] }, // wo
      { zone: 'Toilet',    emoji: '🚽', title: 'Toilet schoonmaken',    recur_freq: RECUR.WEEKLY,  recur_interval: 1, recur_weekdays: [6] },
      { zone: 'Algemeen',  emoji: '🧹', title: 'Stof afnemen',          recur_freq: RECUR.WEEKLY,  recur_interval: 2, recur_weekdays: [] },
      { zone: 'Ramen',     emoji: '🪟', title: 'Ramen lappen',          recur_freq: RECUR.MONTHLY, recur_interval: 3, recur_weekdays: [] },
    ],
  },
  {
    key: 'licht',
    label: 'Licht schema',
    description: 'Voor een klein huishouden of appartement.',
    rooms: [
      { zone: 'Badkamer',  emoji: '🛁', title: 'Badkamer schoonmaken', recur_freq: RECUR.WEEKLY,  recur_interval: 2, recur_weekdays: [6] },
      { zone: 'Keuken',    emoji: '🍳', title: 'Keuken dweilen',        recur_freq: RECUR.WEEKLY,  recur_interval: 1, recur_weekdays: [0] },
      { zone: 'Algemeen',  emoji: '🧹', title: 'Stofzuigen & stoffen',  recur_freq: RECUR.WEEKLY,  recur_interval: 1, recur_weekdays: [6] },
    ],
  },
];

export const getCleaningTemplate = (key) => CLEANING_TEMPLATES.find((t) => t.key === key) ?? null;

// Eerstvolgende vervaldatum vanaf startDate. Bij wekelijks-met-weekdagen: de
// eerste dag (incl. startDate zelf) waarvan de weekdag in de set zit. Anders:
// startDate. Geeft 'yyyy-MM-dd' terug.
export function firstDueDate(startDate, freq, weekdays) {
  let d = startDate;
  if (freq === RECUR.WEEKLY && weekdays?.length) {
    const set = new Set(weekdays);
    for (let i = 0; i < 7; i++) {
      if (set.has(d.getDay())) break;
      d = addDays(d, 1);
    }
  }
  return format(d, 'yyyy-MM-dd');
}

// Normaliseer een zonenaam voor vergelijking (case- en spatie-ongevoelig).
const norm = (s) => (s ?? '').trim().toLowerCase();

// Gedeelde kern: zet een lijst kamers (zone + cadans + titel) om naar wat er
// aangemaakt moet worden, gegeven de al bestaande zones (om dubbele zones te
// vermijden) en een startdatum.
//   -> { zonesToCreate: [{ name, emoji, sort_order }],
//        tasks: [{ title, category, zone_name, due_date, recur_freq,
//                  recur_interval, recur_weekdays, visibility }] }
// De caller maakt eerst de zones aan, mapt zone_name -> id, en schrijft dan de taken.
// planTemplate (vaste sjablonen) en buildCustomSchedule (zelf samengesteld rooster)
// delen exact deze logica, zodat een custom rooster precies als een sjabloon landt.
function buildSchedule(rooms, { existingZones = [], startDate = new Date() } = {}) {
  const existing = new Set(existingZones.map((z) => norm(z.name)));
  const seen = new Set();
  const zonesToCreate = [];

  for (const room of rooms) {
    const key = norm(room.zone);
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    zonesToCreate.push({ name: room.zone, emoji: room.emoji ?? '🧹', sort_order: zonesToCreate.length });
  }

  const tasks = rooms.map((room) => ({
    title: room.title,
    category: 'huishouden',
    zone_name: room.zone,
    due_date: firstDueDate(startDate, room.recur_freq, room.recur_weekdays),
    recur_freq: room.recur_freq,
    recur_interval: room.recur_interval ?? 1,
    recur_weekdays: room.recur_freq === RECUR.WEEKLY && room.recur_weekdays?.length ? room.recur_weekdays : null,
    visibility: VISIBILITY.HOUSEHOLD,
  }));

  return { zonesToCreate, tasks };
}

// Een vast sjabloon (CLEANING_TEMPLATES) omzetten naar de aan te maken zones + taken.
export function planTemplate(template, opts = {}) {
  return buildSchedule(template.rooms, opts);
}

// SCH-4: een zélf samengesteld rooster. Elke `room` is een door de gebruiker gekozen
// zone + cadans (recur_freq/-interval/-weekdays). Een ontbrekende titel valt terug op
// "<zone> schoonmaken" zodat de taak altijd een betekenisvolle naam heeft; kamers
// zónder zonenaam vallen weg (een rooster-regel zonder zone heeft geen plek).
export function buildCustomSchedule(rooms, opts = {}) {
  const normalized = (rooms ?? [])
    .filter((r) => norm(r.zone) !== '')
    .map((r) => ({ ...r, title: (r.title ?? '').trim() || `${r.zone.trim()} schoonmaken` }));
  return buildSchedule(normalized, opts);
}
