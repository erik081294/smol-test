// @ts-check
// Pure kern van de tijdlijn / prikbord (TML-1, plan 19): ordent berichten voor de
// feed, vat een post samen en valideert of een bericht geplaatst mag worden. Géén
// React/Supabase/IO hier, zodat het los te unit-testen is. Relatieve tijd hergebruiken
// we uit lib/activity.js i.p.v. te dupliceren (één bron van waarheid).
import { relativeTime } from './activity';

// Ms sinds epoch uit een Date/ISO-string/number. NaN-veilig → -Infinity, zodat een
// ontbrekende/ongeldige waarde altijd onderaan sorteert (nooit bovenaan belandt).
function ms(v) {
  if (v == null) return -Infinity;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : -Infinity;
}

// Ordent de tijdlijn voor weergave: gepinde berichten eerst (op pinned_at desc),
// daarna de ongepinde op created_at desc. Sorteert op een kopie (muteert de invoer
// niet), zodat het veilig is om op de hook-state te draaien.
export function orderTimeline(posts = []) {
  return [...posts].sort((a, b) => {
    const ap = a?.pinned_at != null;
    const bp = b?.pinned_at != null;
    if (ap !== bp) return ap ? -1 : 1;               // gepind altijd boven ongepind
    if (ap && bp) {                                   // beide gepind: nieuwste pin eerst
      const d = ms(b.pinned_at) - ms(a.pinned_at);
      if (d !== 0) return d;
    }
    return ms(b?.created_at) - ms(a?.created_at);     // anders: nieuwste post eerst
  });
}

// Vat een post samen voor de feed-kaart. Relatieve tijd via lib/activity.js.
// `now` is injecteerbaar voor deterministische tests.
export function summarizePost(post, { now = Date.now() } = {}) {
  const photos = Array.isArray(post?.photos) ? post.photos : [];
  const body = typeof post?.body === 'string' ? post.body.trim() : '';
  return {
    id: post?.id,
    body,
    hasBody: body.length > 0,
    photoCount: photos.length,
    hasPhotos: photos.length > 0,
    pinned: post?.pinned_at != null,
    when: relativeTime(post?.created_at, now),
    authorId: post?.author_id,
  };
}

// App-laag-validatie: een bericht moet tekst óf minstens één foto hebben (de DB
// dwingt dit bewust niet af, conform plant_photos). Pure predicaat.
/** @param {{ body?: string, photoCount?: number }} [post] */
export function isPostValid({ body, photoCount = 0 } = {}) {
  const hasBody = typeof body === 'string' && body.trim().length > 0;
  return hasBody || photoCount > 0;
}

// ── Emoji-reacties (TML-3, plan 19) ────────────────────────────────────────
// Pure aggregatie onder de reactie-chips. `timeline_reactions` is één rij per
// (lid, doel, emoji); de app laadt de rijen van een doel en vat ze hier samen tot
// tellers. Géén IO — de hook levert de al-geladen rijen aan.

/**
 * Vat de reactie-rijen van één doel samen tot teller-chips. Per emoji: hoeveel
 * leden 'm gaven (`count`) en of de kijker er zelf bij zit (`mine` — de togglestaat
 * van de picker). Gesorteerd op count desc, dan emoji oplopend (stabiele volgorde,
 * onafhankelijk van invoervolgorde). Rijen zonder emoji tellen niet mee.
 * @param {{ emoji?: string, author_id?: * }[]} [rows]
 * @param {*} [viewerId]
 * @returns {{ emoji: string, count: number, mine: boolean }[]}
 */
export function aggregateReactions(rows = [], viewerId) {
  /** @type {Map<string, { emoji: string, count: number, mine: boolean }>} */
  const byEmoji = new Map();
  for (const r of rows) {
    const emoji = r?.emoji;
    if (typeof emoji !== 'string' || emoji === '') continue;
    const entry = byEmoji.get(emoji) ?? { emoji, count: 0, mine: false };
    entry.count += 1;
    if (r.author_id === viewerId) entry.mine = true;
    byEmoji.set(emoji, entry);
  }
  // Sort: meeste eerst; bij gelijke count de emoji oplopend als stabiele tie-break.
  // Twee entries delen nooit dezelfde emoji (de Map dedupeert erop), dus de gelijk-tak
  // bestaat niet — vandaar de tweewegs `? -1 : 1` i.p.v. een drieweg-vergelijking.
  return [...byEmoji.values()].sort((a, b) => (b.count - a.count) || (a.emoji < b.emoji ? -1 : 1));
}

// Stabiel doel-id voor een reactie op een systeem-event: '<bron_tabel>:<bron_id>'.
// Bewust de échte bron-tabelnaam + -id (niet de UI-interne feed-prefix, die mag
// wijzigen), zodat een reactie aan het event vastgeklonken blijft over reloads heen.
/** @param {string} table @param {*} id @returns {string} */
export function eventReactionTarget(table, id) {
  return `${table}:${id}`;
}
