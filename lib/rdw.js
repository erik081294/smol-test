// @ts-check
// Kenteken → auto-type via de open data van de RDW (VTG-3). Pure helpers (normaliseren,
// valideren, URL bouwen, een RDW-record mappen) + een niet-blokkerende lookup met timeout
// en stille fallback. Géén React; de UI roept lookupPlate() debounced aan en vult de velden
// die overschrijfbaar blijven.
//
// Ontwerp (zie backlog §2): de lookup is een VERRIJKING, geen vereiste. Bij een trage/
// onbereikbare RDW, geen internet of een onbekend/ongeldig kenteken valt 'ie stil terug op
// handmatige invoer (null). Geen call bij evident ongeldige invoer (bespaart een request en
// is fair-use richting de RDW). Het kenteken wordt eerst lokaal genormaliseerd.

const RDW_ENDPOINT = 'https://opendata.rdw.nl/resource/m9d7-ebf2.json';
const DEFAULT_TIMEOUT_MS = 5000;

// Canonieke vorm: hoofdletters, alleen letters/cijfers (streepjes/spaties eruit).
//   '12-ab-3' -> '12AB3', ' xy-99-z ' -> 'XY99Z'
export function normalizePlate(raw) {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Lichte validatie: een NL-kenteken is 6 tekens, uitsluitend letters/cijfers, en bevat
// zowel een letter als een cijfer (sluit '123456'/'ABCDEF' uit). Bewust soepel — de RDW
// is de échte autoriteit; dit voorkomt alleen zinloze calls bij evident foute invoer.
export function isValidPlate(raw) {
  const p = normalizePlate(raw);
  return p.length === 6 && /[A-Z]/.test(p) && /[0-9]/.test(p);
}

// De RDW-query-URL voor een (genormaliseerd) kenteken.
export function rdwUrl(raw) {
  return `${RDW_ENDPOINT}?kenteken=${normalizePlate(raw)}`;
}

// Eerste letter per woord een hoofdletter (RDW levert merk/model in kapitalen:
// 'VOLKSWAGEN' -> 'Volkswagen', 'GOLF PLUS' -> 'Golf Plus'). Leeg → null.
function titleCase(s) {
  const t = String(s ?? '').trim().toLowerCase();
  if (!t) return null;
  return t.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// RDW levert datums als 'YYYYMMDD' (string of getal), bv. 20251231 → '2025-12-31'.
// Onbruikbaar (leeg, verkeerde lengte, evidente onzin) → null. Puur, los testbaar.
export function parseRdwDate(raw) {
  const s = String(raw ?? '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

// Niet-negatief geheel getal uit RDW-tekst (massa, prijs in hele euro's), of null.
function toIntOrNull(raw) {
  const n = parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Map één RDW-record naar onze voertuigvelden (puur, los testbaar zonder netwerk).
//   merk -> make, handelsbenaming -> model, voertuigsoort -> vehicleType,
//   eerste_kleur -> color, inrichting -> bodyType (carrosserie),
//   vervaldatum_apk -> apkExpiry, datum_eerste_toelating -> firstRegistration,
//   catalogusprijs (hele euro's) -> catalogPriceCents, massa_ledig_voertuig -> curbWeightKg.
// Geen bruikbaar record (geen merk én geen model) → null. Verrijkingsvelden zijn
// optioneel: ontbreken ze, dan null (de UI valt netjes terug op handmatig/leeg).
export function parseRdwRecord(row) {
  if (!row) return null;
  const make = titleCase(row.merk);
  const model = titleCase(row.handelsbenaming);
  const vehicleType = titleCase(row.voertuigsoort);
  if (!make && !model) return null;
  const catalogPrice = toIntOrNull(row.catalogusprijs);
  return {
    make, model, vehicleType,
    color: titleCase(row.eerste_kleur),
    bodyType: titleCase(row.inrichting),
    apkExpiry: parseRdwDate(row.vervaldatum_apk),
    firstRegistration: parseRdwDate(row.datum_eerste_toelating),
    catalogPriceCents: catalogPrice == null ? null : catalogPrice * 100,
    curbWeightKg: toIntOrNull(row.massa_ledig_voertuig),
  };
}

// Niet-blokkerende lookup. Geeft { make, model, vehicleType } of null (ongeldig kenteken,
// timeout, netwerk-/parse-fout, geen record). `fetchImpl` is injecteerbaar voor tests.
/**
 * @param {string} raw
 * @param {{ fetchImpl?: Function, timeoutMs?: number }} [opts]
 */
export async function lookupPlate(raw, { fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!isValidPlate(raw)) return null;
  const doFetch = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!doFetch) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(rdwUrl(raw), controller ? { signal: controller.signal } : undefined);
    if (!res?.ok) return null;
    const rows = await res.json();
    return parseRdwRecord(Array.isArray(rows) ? rows[0] : null);
  } catch {
    return null; // timeout / offline / parse-fout → stille fallback
  } finally {
    if (timer) clearTimeout(timer);
  }
}
