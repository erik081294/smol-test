// @ts-check
// Pure, regelgebaseerde onderhoudslogica voor voertuigen (VTG-1). Géén React/Supabase
// en geen RDW-call: een vaste set auto-onderhoudssjablonen die we als voor-aangevinkte
// checklist aanbieden — net als de huisdier-routines (lib/petCare.js). Betrouwbaar en
// uitlegbaar; de gebruiker bevestigt of schaaft bij.
//
// Onderhoudstaken zijn gewone tasks: category 'voertuig' + vehicle_id. Ze erven de
// zichtbaarheid van het voertuig en lopen via de bestaande recurrence-logica. RECUR kent
// geen 'yearly', dus jaarlijks = maandelijks × 12, 2-jaarlijks × 24, enzovoort.
//
// Plannen kan op datum (de recurrence) én op km-stand: een sjabloon met `kmInterval`
// levert via nextServiceMileage() de volgende beurt-kilometerstand.
import { format } from 'date-fns';
import { RECUR, VISIBILITY } from './constants';

// Interval-helpers zodat de templates leesbaar blijven (interval in maanden).
const monthly = (n = 1) => ({ freq: RECUR.MONTHLY, interval: n });
const yearly = (n = 1) => monthly(12 * n);

// Onderhoudssjablonen voor een (personen)auto. Eén generieke set; merk/model variëren
// in de praktijk maar de routine niet. { key, title, ...interval, kmInterval?, defaultOn, hint }.
// `defaultOn: true` staat voor-aangevinkt (de wettelijke/gangbare basis); de rest is
// optioneel en één tik weg.
const MAINTENANCE = [
  { key: 'apk', title: 'APK-keuring', ...yearly(), defaultOn: true, hint: 'Jaarlijks voor auto’s vanaf 3 jaar' },
  { key: 'kleine_beurt', title: 'Kleine beurt', ...yearly(), kmInterval: 15000, defaultOn: true, hint: 'Jaarlijks of elke 15.000 km' },
  { key: 'grote_beurt', title: 'Grote beurt', ...yearly(2), kmInterval: 30000, defaultOn: true, hint: 'Elke 2 jaar of 30.000 km' },
  { key: 'olie', title: 'Olie verversen', ...yearly(), kmInterval: 15000, defaultOn: true, hint: 'Jaarlijks of elke 15.000 km' },
  { key: 'banden', title: 'Banden wisselen (zomer/winter)', ...monthly(6), defaultOn: true, hint: 'Voorjaar en najaar' },
  { key: 'distributieriem', title: 'Distributieriem vervangen', ...yearly(4), kmInterval: 90000, defaultOn: false, hint: 'Vaak elke 4 jaar of ~90.000 km — check je handleiding' },
  { key: 'airco', title: 'Airco-service', ...yearly(2), defaultOn: false, hint: 'Bijvullen/ontsmetten, meestal elke 2 jaar' },
  { key: 'remmen', title: 'Remmen controleren', ...yearly(), defaultOn: false },
];

// De volledige sjabloonlijst (voor de checklist-UI).
export function maintenanceTemplates() {
  return MAINTENANCE;
}

// De keys die standaard voor-aangevinkt staan.
export function defaultMaintenanceKeys() {
  return MAINTENANCE.filter((tpl) => tpl.defaultOn).map((tpl) => tpl.key);
}

// Genereer de onderhoudstaken-payloads voor een voertuig. De caller vult household_id
// en created_by aan en schrijft ze naar `tasks`.
//   vehicle:      { id, name, visibility, share_subgroup_id, share_with }
//   selectedKeys: aangevinkte template-keys (default = de defaultOn-set)
//   overrides:    optioneel { [key]: interval } om een interval (in maanden) bij te schaven
export function buildMaintenanceTasks(vehicle, selectedKeys, { startDate = new Date(), overrides = {} } = {}) {
  if (!vehicle) return [];
  const keys = new Set(selectedKeys ?? defaultMaintenanceKeys());
  const due = format(startDate, 'yyyy-MM-dd');
  // Échte APK-vervaldatum uit de RDW (V1): de APK-taak valt dan op de werkelijke datum
  // i.p.v. "vanaf vandaag". Alleen een geldige ISO-datum telt; anders de gewone startdatum.
  const apkDate = /^\d{4}-\d{2}-\d{2}$/.test(String(vehicle.apk_expires_on ?? '')) ? vehicle.apk_expires_on : null;
  const vis = {
    visibility: vehicle.visibility ?? VISIBILITY.HOUSEHOLD,
    share_subgroup_id: vehicle.visibility === VISIBILITY.SUBGROUP ? (vehicle.share_subgroup_id ?? null) : null,
    share_with: vehicle.visibility === VISIBILITY.CUSTOM ? (vehicle.share_with ?? []) : null,
  };

  return MAINTENANCE
    .filter((tpl) => keys.has(tpl.key))
    .map((tpl) => ({
      title: `${tpl.title} — ${vehicle.name}`,
      category: 'voertuig',
      vehicle_id: vehicle.id,
      due_date: tpl.key === 'apk' && apkDate ? apkDate : due,
      recur_freq: tpl.freq,
      recur_interval: Math.max(1, overrides[tpl.key] ?? tpl.interval),
      recur_weekdays: null,
      ...vis,
    }));
}

// Volgende beurt-kilometerstand voor een km-gebonden sjabloon, of null als het sjabloon
// niet op km plant of er (nog) geen geldige km-stand bekend is. Puur, voor de planning-UI.
export function nextServiceMileage(template, currentMileage) {
  if (!template?.kmInterval) return null;
  const km = Number(currentMileage);
  if (!Number.isFinite(km) || km < 0) return null;
  return km + template.kmInterval;
}

// Duizendtal-scheiding met punt (NL), deterministisch (geen Intl/locale-afhankelijkheid
// in de unit-tests). 90000 -> "90.000".
function groupThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Leesbare samenvatting van het onderhoudsinterval (datum + evt. km), voor in de UI.
//   jaarlijks · elke 2 jaar · elke 6 maanden, eventueel "… of elke 15.000 km".
export function intervalLabel(template) {
  if (!template) return '';
  const months = template.interval ?? 1;
  const datePart = months % 12 === 0
    ? (months === 12 ? 'jaarlijks' : `elke ${months / 12} jaar`)
    : (months === 1 ? 'maandelijks' : `elke ${months} maanden`);
  return template.kmInterval
    ? `${datePart} of elke ${groupThousands(template.kmInterval)} km`
    : datePart;
}
