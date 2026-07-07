// @ts-check
// Globaal zoeken (PLT-3) — pure rangschik- en routeer-logica onder app/zoeken.js.
//
// De server (RPC global_search, migratie 0075) filtert goedkoop voor (ilike per
// tabel, max 10 per bron); hier bepalen we de vólgorde en waar een tik heen
// navigeert. Geen React/Supabase — unit-getest in tests/searchRank.test.js en
// ratchet-bewaakt (scripts/mutation-groups.mjs).

import { getModule } from './modules';

// kind (uit de RPC) → module-key. Eén bron van waarheid voor groeperen,
// module-icoon en de tab-terugval van routeForHit.
const KIND_MODULE = {
  task: 'taken',
  grocery: 'boodschappen',
  recipe: 'maaltijden',
  expense: 'kosten',
  plant: 'planten',
  pet: 'huisdieren',
  vehicle: 'voertuigen',
  timeline: 'tijdlijn',
};

/**
 * De module-key waar een hit-soort bij hoort (voor groeperen/icoon).
 * @param {string} [kind]
 * @returns {string | null}
 */
export function moduleForKind(kind) {
  return KIND_MODULE[/** @type {keyof KIND_MODULE} */ (kind)] ?? null;
}

// Match-rang: lager = beter. Exact (0) > prefix (1) > woordgrens (2) >
// substring (3) > geen match (4). Case-insensitief; een lege zoekterm telt
// als prefix-van-alles zodat rankResults dan puur op recentheid sorteert.
/**
 * @param {string} [title]
 * @param {string} [query]
 * @returns {number}
 */
export function matchRank(title, query) {
  const tl = String(title ?? '').toLowerCase();
  const q = String(query ?? '').trim().toLowerCase();
  if (tl === q) return 0;
  if (tl.startsWith(q)) return 1;
  const idx = tl.indexOf(q);
  if (idx < 0) return 4;
  // Woordgrens: het teken vóór de match is geen letter/cijfer ("grote mand"
  // wint van "boodschappenmand").
  if (/[^\p{L}\p{N}]/u.test(tl.charAt(idx - 1))) return 2;
  return 3;
}

/**
 * Rangschik zoekresultaten: beste match-rang eerst; bij gelijke rang wint de
 * recentste hit (happened_on, ISO-datumstring; ontbrekend = oudst); daarna
 * blijft de invoer-volgorde staan (stabiel).
 * @param {Array<{ title?: string, happened_on?: string | null }>} [rows]
 * @param {string} [query]
 */
export function rankResults(rows = [], query = '') {
  const scored = rows.map((row, index) => ({
    row,
    index,
    rank: matchRank(row?.title, query),
    // ISO-datums ('2026-07-06') vergelijken lexicografisch correct; ontbrekend
    // veld valt terug op '' en sorteert dus als oudste.
    when: row?.happened_on ?? '',
  }));
  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.when !== b.when) return a.when < b.when ? 1 : -1;
    return a.index - b.index;
  });
  return scored.map((s) => s.row);
}

// kind → detail-route-segment. Boodschappen ontbreken bewust: een lijst-item
// heeft geen detailscherm, dus die hit landt op de Boodschappen-tab.
const DETAIL_SEGMENT = {
  task: 'task',
  recipe: 'recipe',
  expense: 'expense',
  plant: 'plant',
  pet: 'pet',
  vehicle: 'vehicle',
  timeline: 'tijdlijn',
};

/**
 * De interne route voor een zoek-hit: het detailscherm als dat bestaat
 * (bv. /recipe/<id>), anders de module-tab; onbekende soort → null.
 * @param {{ kind?: string, id?: string } | null} [hit]
 * @returns {string | null}
 */
export function routeForHit(hit = null) {
  const kind = hit?.kind;
  const moduleKey = moduleForKind(kind);
  if (!moduleKey) return null;
  const segment = DETAIL_SEGMENT[/** @type {keyof DETAIL_SEGMENT} */ (kind)];
  if (segment && hit?.id) return `/${segment}/${hit.id}`;
  // Geen detailscherm (boodschappen) of geen id → de tab van de module.
  const route = getModule(moduleKey)?.route;
  return route ? `/(tabs)/${route}` : null;
}
