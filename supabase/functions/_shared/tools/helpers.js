// @ts-check
// Gedeelde pure helpers voor de assistent-tool-packs (tools/<module>.js).
// Alleen datum-/formatteer-/query-hulpjes — géén tool-descriptors: die leven in
// de packs zelf, dit bestand houdt ze DRY zonder een tweede registry te worden.

/** Centen → "€ 12,34" (NL-notatie). @param {number} cents */
export const fmtEuro = (cents) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

/**
 * Supabase-antwoord → data of throw. De agent-schil vangt de throw en maakt er
 * een { error }-tool-resultaat van zodat het model netjes kan reageren.
 * @param {{ data: any, error: { message?: string } | null }} res
 */
export const throwOnError = ({ data, error }) => {
  if (error) throw new Error(error.message ?? 'query mislukt');
  return data ?? [];
};

/**
 * "YYYY-MM" → eerste dag van de volgende maand ("YYYY-MM-01"), zuivere string-
 * rekensom (geen Date, dus geen tijdzone-verrassingen). December rolt het jaar door.
 * @param {string} month
 */
export function nextMonth(month) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m >= 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * YYYY-MM-DD + n dagen, via UTC zodat de uitkomst niet van de servertijdzone afhangt.
 * @param {string} isoDate
 * @param {number} days
 */
export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTH_NAMES = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** Geldige kalenderdatum als "YYYY-MM-DD"? (regex + round-trip, vangt 2026-02-31). @param {string} [s] */
export function isIsoDate(s) {
  // Stryker disable next-line all -- de regex is een fast-path; de Date-round-trip
  // hieronder verwerpt alles wat hier doorheen zou glippen (equivalente mutanten).
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * "2026-07-10" → "vr 10 jul" — compact NL-datumlabel voor lijsten/kaarten.
 * Puur en tz-vast (UTC); ongeldige invoer → de invoer zelf (nooit crashen op data).
 * @param {string} isoDate
 */
export function dayLabel(isoDate) {
  if (!isIsoDate(isoDate)) return typeof isoDate === 'string' ? isoDate : '';
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

// HH:MM-vorm (24-uurs) voor reserverings-tijden.
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Geldige HH:MM-tijd? @param {string} [s] */
export function isHhmm(s) {
  return typeof s === 'string' && HHMM_RE.test(s);
}

/**
 * Lokale datum+tijd → UTC-instant (ISO, Z). De offset komt van de client
 * (minuten óóst van UTC, bv. 120 voor NL-zomertijd) — de edge kent de
 * device-tijdzone niet. Puur UTC-rekenwerk; ongeldige invoer → null.
 * @param {string} date YYYY-MM-DD (lokale dag)
 * @param {string} hhmm HH:MM (lokale tijd)
 * @param {number} offsetMinutes minuten oost van UTC (−840..840)
 * @returns {string|null}
 */
export function toUtcIso(date, hhmm, offsetMinutes) {
  if (!isIsoDate(date) || !isHhmm(hhmm)) return null;
  const off = Number.isInteger(offsetMinutes) && Math.abs(offsetMinutes) <= 840 ? offsetMinutes : 0;
  const d = new Date(`${date}T${hhmm}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() - off);
  return d.toISOString();
}

/**
 * UTC-instant → lokale HH:MM voor weergave (zelfde offset-conventie).
 * Onleesbaar → '' (nooit crashen op data).
 * @param {string|null|undefined} iso
 * @param {number} offsetMinutes
 * @returns {string}
 */
export function localHhmm(iso, offsetMinutes) {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return '';
  const off = Number.isInteger(offsetMinutes) && Math.abs(offsetMinutes) <= 840 ? offsetMinutes : 0;
  return new Date(t + off * 60000).toISOString().slice(11, 16);
}

/**
 * UTC-instant → lokale YYYY-MM-DD (voor dag-groepering in de eigen tijdzone).
 * @param {string|null|undefined} iso
 * @param {number} offsetMinutes
 * @returns {string}
 */
export function localDate(iso, offsetMinutes) {
  const t = Date.parse(iso ?? '');
  if (Number.isNaN(t)) return '';
  const off = Number.isInteger(offsetMinutes) && Math.abs(offsetMinutes) <= 840 ? offsetMinutes : 0;
  return new Date(t + off * 60000).toISOString().slice(0, 10);
}

/**
 * Ledennaam → profiel-id, hoofdletter-ongevoelig op de hele naam.
 * Niet gevonden of dubbelzinnig (twee leden met dezelfde naam) → null: de tool
 * laat het item dan liever ongekoppeld dan verkeerd gekoppeld.
 * @param {string} [name]
 * @param {Record<string, string>} [memberNames] profiel-id → weergavenaam
 * @returns {string|null}
 */
export function resolveMemberId(name, memberNames = {}) {
  const needle = (name ?? '').trim().toLowerCase();
  if (!needle) return null;
  const hits = Object.entries(memberNames).filter(([, n]) => (n ?? '').trim().toLowerCase() === needle);
  return hits.length === 1 ? hits[0][0] : null;
}
