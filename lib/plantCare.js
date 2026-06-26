// @ts-check
// Pure, regelgebaseerde verzorgingslogica voor planten. Géén React/Supabase en
// géén AI: op basis van soort + seizoen genereren we water-/voedingstaken en een
// verzorgingskaart. Betrouwbaar en uitlegbaar; AI-soortherkenning is een latere,
// aparte stap (de handmatige soortkeuze blijft altijd de terugval).
//
// Verzorgingstaken zijn gewone tasks: category 'plant' + plant_id. Ze erven de
// zichtbaarheid van de plant en lopen via de bestaande recurrence-logica.
import { format } from 'date-fns';
import { RECUR, VISIBILITY } from './constants';

// NL-seizoen: groei maart–september, rust oktober–februari. month is 0-gebaseerd.
export function season(date = new Date()) {
  const m = date.getMonth();
  return m >= 2 && m <= 8 ? 'growing' : 'resting';
}

// Het wateinterval (in dagen) voor dit seizoen.
export function waterIntervalDays(species, date = new Date()) {
  return season(date) === 'growing' ? species.water_days_growing : species.water_days_resting;
}

// Genereer de verzorgingstaken-payloads voor een plant. De caller vult nog
// household_id en created_by aan en schrijft ze naar `tasks`.
//   plant:   { id, name, visibility, share_subgroup_id, share_with }
//   species: { water_days_growing, water_days_resting, feed_weeks_growing, ... }
export function buildCareTasks(plant, species, { startDate = new Date() } = {}) {
  if (!species) return [];
  const due = format(startDate, 'yyyy-MM-dd');
  const vis = {
    visibility: plant.visibility ?? VISIBILITY.HOUSEHOLD,
    share_subgroup_id: plant.visibility === VISIBILITY.SUBGROUP ? (plant.share_subgroup_id ?? null) : null,
    share_with: plant.visibility === VISIBILITY.CUSTOM ? (plant.share_with ?? []) : null,
  };

  const tasks = [{
    title: `Water geven — ${plant.name}`,
    category: 'plant',
    plant_id: plant.id,
    due_date: due,
    recur_freq: RECUR.DAILY,
    recur_interval: waterIntervalDays(species, startDate),
    recur_weekdays: null,
    ...vis,
  }];

  // Voeding alleen in het groeiseizoen, en alleen als de soort het nodig heeft.
  if (season(startDate) === 'growing' && species.feed_weeks_growing) {
    tasks.push({
      title: `Voeding geven — ${plant.name}`,
      category: 'plant',
      plant_id: plant.id,
      due_date: due,
      recur_freq: RECUR.WEEKLY,
      recur_interval: species.feed_weeks_growing,
      recur_weekdays: null,
      ...vis,
    });
  }

  return tasks;
}

// Pure zoek-helper: filtert soorten op vrije tekst (naam, latijn of search-veld).
export function searchSpecies(species, query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return species ?? [];
  return (species ?? []).filter((s) =>
    (s.search ?? '').includes(q) ||
    (s.common_name ?? '').toLowerCase().includes(q) ||
    (s.latin_name ?? '').toLowerCase().includes(q)
  );
}

const LIGHT_LABEL = {
  schaduw: 'Schaduw', halfschaduw: 'Halfschaduw', licht: 'Veel licht', 'vol-zon': 'Volle zon',
};

// Leesbare verzorgingskaart uit de soortregels (voor het detailscherm).
export function careCard(species, location) {
  if (!species) {
    return { light: '—', waterText: 'Stel zelf een waterinterval in', feedText: '—', notes: null, location };
  }
  return {
    light: LIGHT_LABEL[species.light] ?? '—',
    waterText: `Groei: elke ${species.water_days_growing} dagen · Rust: elke ${species.water_days_resting} dagen`,
    feedText: species.feed_weeks_growing
      ? `Elke ${species.feed_weeks_growing} weken in het groeiseizoen (mrt–sep)`
      : 'Geen extra voeding nodig',
    notes: species.care_notes ?? null,
    location,
  };
}
