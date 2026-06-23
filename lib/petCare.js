// Pure, regelgebaseerde verzorgingslogica voor huisdieren. Géén React/Supabase en
// géén AI: per diersoort een vaste, real-world verzorgingsroutine die we als een
// voor-aangevinkte checklist aanbieden. Betrouwbaar en uitlegbaar; de gebruiker
// hoeft niets te bedenken, alleen te bevestigen of bij te schaven.
//
// Anders dan planten (honderden soorten → een DB-seed met intervallen) zijn er maar
// een handvol diertypen met elk een bekende set verzorgingstaken — die regels horen
// daarom in code (testbaar, makkelijk te finetunen, geen migratie-churn).
//
// Verzorgingstaken zijn gewone tasks: category 'huisdier' + pet_id. Ze erven de
// zichtbaarheid van het dier en lopen via de bestaande recurrence-logica. Jaarlijks
// = maandelijks × 12, kwartaal = × 3, halfjaar = × 6 (RECUR kent geen 'yearly').
import { differenceInMonths, format } from 'date-fns';
import { RECUR, VISIBILITY } from './constants';

// Diertypen (key = wat we in pets.type opslaan; 'anders' vangt de rest). De emoji
// is gebruikersdata-achtig label voor de soortkiezer; de UI-iconen blijven los.
export const PET_TYPES = [
  { key: 'hond', label: 'Hond', emoji: '🐕' },
  { key: 'kat', label: 'Kat', emoji: '🐈' },
  { key: 'konijn', label: 'Konijn', emoji: '🐇' },
  { key: 'knaagdier', label: 'Knaagdier', emoji: '🐹' },
  { key: 'vogel', label: 'Vogel', emoji: '🐦' },
  { key: 'vis', label: 'Vis', emoji: '🐠' },
  { key: 'reptiel', label: 'Reptiel', emoji: '🦎' },
  { key: 'anders', label: 'Anders', emoji: '🐾' },
];

export const PET_TYPE_KEYS = PET_TYPES.map((t) => t.key);

const TYPE_BY_KEY = Object.fromEntries(PET_TYPES.map((t) => [t.key, t]));
export const petType = (key) => TYPE_BY_KEY[key] ?? TYPE_BY_KEY.anders;

// Korte interval-helpers, zodat de templates leesbaar blijven.
const daily = (n = 1) => ({ freq: RECUR.DAILY, interval: n });
const weekly = (n = 1) => ({ freq: RECUR.WEEKLY, interval: n });
const monthly = (n = 1) => ({ freq: RECUR.MONTHLY, interval: n });
const quarterly = () => monthly(3);
const halfYearly = () => monthly(6);
const yearly = () => monthly(12);

// Verzorgingsroutine per diersoort: een lijst templates met
//   { key, title, ...interval, defaultOn, hint }
// `defaultOn: true` staat voor-aangevinkt in de checklist (de dagelijkse basis +
// gezondheid); optionele taken (borstelen, nagels…) staan uit maar zijn één tik weg.
const TEMPLATES = {
  hond: [
    { key: 'voeren', title: 'Voeren', ...daily(), defaultOn: true },
    { key: 'uitlaten', title: 'Uitlaten', ...daily(), defaultOn: true },
    { key: 'vlooien', title: 'Vlooien- en tekenmiddel', ...monthly(), defaultOn: true, hint: 'Spot-on of band, meestal maandelijks' },
    { key: 'ontwormen', title: 'Ontwormen', ...quarterly(), defaultOn: true, hint: 'Standaard elke 3 maanden' },
    { key: 'vaccinatie', title: 'Vaccinatie', ...yearly(), defaultOn: true, hint: 'Jaarlijkse cocktail' },
    { key: 'dierenarts', title: 'Controle dierenarts', ...yearly(), defaultOn: true },
    { key: 'borstelen', title: 'Vacht borstelen', ...weekly(), defaultOn: false },
    { key: 'nagels', title: 'Nagels knippen', ...monthly(), defaultOn: false },
  ],
  kat: [
    { key: 'voeren', title: 'Voeren', ...daily(), defaultOn: true },
    { key: 'kattenbak', title: 'Kattenbak verschonen', ...daily(), defaultOn: true },
    { key: 'vlooien', title: 'Vlooien- en tekenmiddel', ...monthly(), defaultOn: true },
    { key: 'ontwormen', title: 'Ontwormen', ...quarterly(), defaultOn: true, hint: 'Standaard elke 3 maanden' },
    { key: 'vaccinatie', title: 'Vaccinatie', ...yearly(), defaultOn: true },
    { key: 'dierenarts', title: 'Controle dierenarts', ...yearly(), defaultOn: true },
    { key: 'borstelen', title: 'Vacht borstelen', ...weekly(), defaultOn: false },
  ],
  konijn: [
    { key: 'voeren', title: 'Voeren & vers hooi', ...daily(), defaultOn: true },
    { key: 'water', title: 'Vers water', ...daily(), defaultOn: true },
    { key: 'hok', title: 'Hok schoonmaken', ...weekly(), defaultOn: true },
    { key: 'vaccinatie', title: 'Vaccinatie (myxo/VHD)', ...yearly(), defaultOn: true, hint: 'Bescherming tegen myxomatose en VHD' },
    { key: 'nagels', title: 'Nagels knippen', ...weekly(6), defaultOn: false },
    { key: 'dierenarts', title: 'Controle dierenarts', ...yearly(), defaultOn: false },
  ],
  knaagdier: [
    { key: 'voeren', title: 'Voeren', ...daily(), defaultOn: true },
    { key: 'water', title: 'Vers water', ...daily(), defaultOn: true },
    { key: 'verblijf', title: 'Verblijf schoonmaken', ...weekly(), defaultOn: true },
    { key: 'bodem', title: 'Bodembedekking vervangen', ...weekly(), defaultOn: false },
  ],
  vogel: [
    { key: 'voeren', title: 'Voeren', ...daily(), defaultOn: true },
    { key: 'water', title: 'Vers water', ...daily(), defaultOn: true },
    { key: 'kooi', title: 'Kooi schoonmaken', ...weekly(), defaultOn: true },
    { key: 'badwater', title: 'Badwater verversen', ...daily(), defaultOn: false },
  ],
  vis: [
    { key: 'voeren', title: 'Voeren', ...daily(), defaultOn: true },
    { key: 'water', title: 'Water verversen (~20%)', ...weekly(), defaultOn: true },
    { key: 'filter', title: 'Filter schoonmaken', ...monthly(), defaultOn: true },
    { key: 'waterwaarden', title: 'Waterwaarden testen', ...weekly(), defaultOn: false },
  ],
  reptiel: [
    { key: 'water', title: 'Vers water', ...daily(), defaultOn: true },
    { key: 'voeren', title: 'Voeren', ...weekly(), defaultOn: true, hint: 'Verschilt per soort; pas het interval gerust aan' },
    { key: 'terrarium', title: 'Terrarium schoonmaken', ...weekly(), defaultOn: true },
    { key: 'uvlamp', title: 'UV-lamp vervangen', ...halfYearly(), defaultOn: true, hint: 'UV neemt af; meestal elk half jaar' },
  ],
  anders: [
    { key: 'voeren', title: 'Voeren', ...daily(), defaultOn: true },
    { key: 'dierenarts', title: 'Controle dierenarts', ...yearly(), defaultOn: false },
  ],
};

// De verzorgingstemplates voor een diersoort (terugval op 'anders').
export function careTemplates(type) {
  return TEMPLATES[type] ?? TEMPLATES.anders;
}

// De keys die standaard voor-aangevinkt staan in de checklist.
export function defaultCareKeys(type) {
  return careTemplates(type).filter((tpl) => tpl.defaultOn).map((tpl) => tpl.key);
}

// Genereer de verzorgingstaken-payloads voor een dier. De caller vult nog
// household_id en created_by aan en schrijft ze naar `tasks`.
//   pet:          { id, name, type, visibility, share_subgroup_id, share_with }
//   selectedKeys: welke template-keys aanvinkt zijn (default = de defaultOn-set)
//   overrides:    optioneel { [key]: interval } om een interval bij te schaven
export function buildCareTasks(pet, selectedKeys, { startDate = new Date(), overrides = {} } = {}) {
  if (!pet) return [];
  const keys = new Set(selectedKeys ?? defaultCareKeys(pet.type));
  const due = format(startDate, 'yyyy-MM-dd');
  const vis = {
    visibility: pet.visibility ?? VISIBILITY.HOUSEHOLD,
    share_subgroup_id: pet.visibility === VISIBILITY.SUBGROUP ? (pet.share_subgroup_id ?? null) : null,
    share_with: pet.visibility === VISIBILITY.CUSTOM ? (pet.share_with ?? []) : null,
  };

  return careTemplates(pet.type)
    .filter((tpl) => keys.has(tpl.key))
    .map((tpl) => ({
      title: `${tpl.title} — ${pet.name}`,
      category: 'huisdier',
      pet_id: pet.id,
      due_date: due,
      recur_freq: tpl.freq,
      recur_interval: Math.max(1, overrides[tpl.key] ?? tpl.interval),
      recur_weekdays: null,
      ...vis,
    }));
}

// Leesbare leeftijd uit een geboortedatum (of null). "8 maanden" / "3 jaar" /
// "1 jaar, 2 mnd". Voor het detailscherm; puur zodat het te unit-testen is.
export function ageLabel(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const d = typeof birthDate === 'string' ? new Date(`${birthDate}T00:00:00`) : birthDate;
  if (Number.isNaN(d?.getTime?.())) return null;
  const months = differenceInMonths(now, d);
  if (months < 0) return null;
  if (months < 12) return months === 1 ? '1 maand' : `${months} maanden`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const y = years === 1 ? '1 jaar' : `${years} jaar`;
  if (rem === 0) return y;
  return `${y}, ${rem} mnd`;
}
