// Eerlijkheidsoverzicht (SCH-3) — pure logica, los van Supabase/React.
//
// Telt voltooiingen per lid over een periode en geeft een verdeelbaar overzicht
// ("wie deed hoeveel"). Voedt lib/FairnessBars.js.

// Hoeveel dagen een periode terugkijkt. null = alle tijd.
export const PERIODS = { WEEK: 7, MONTH: 30, ALL: null };

// De ondergrens-datum voor een periode, of null bij "alle tijd".
export function sinceDate(period, now = new Date()) {
  if (period == null) return null;
  return new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
}

// Telt voltooiingen per lid.
//   completions: [{ completed_by, completed_at }]  (uit task_completions)
//   members:     [{ id, display_name, avatar_emoji }]
//   since:       Date | null  (null = alle tijd; oudere voltooiingen tellen niet)
// -> [{ profileId, name, emoji, count, pct }], gesorteerd op count desc en
//    stabiel op profileId. Leden met 0 voltooiingen staan er ook bij.
//
// Beslissing: een voltooiing met een onbekende completed_by (lid verwijderd ->
// null, of geen lid meer van het huishouden) telt NIET mee. Het overzicht gaat
// over de huidige leden; "spookrijen" zouden de verdeling vertekenen.
export function tally(completions = [], members = [], since = null) {
  const sinceMs = since ? since.getTime() : null;
  const counts = new Map(members.map((m) => [m.id, 0]));

  for (const c of completions) {
    if (!c || c.completed_by == null) continue;
    if (!counts.has(c.completed_by)) continue; // geen huidig lid -> overslaan
    if (sinceMs != null) {
      const t = c.completed_at ? new Date(c.completed_at).getTime() : null;
      if (t == null || t < sinceMs) continue;
    }
    counts.set(c.completed_by, counts.get(c.completed_by) + 1);
  }

  let total = 0;
  for (const n of counts.values()) total += n;
  const denom = Math.max(1, total);

  return members
    .map((m) => {
      const count = counts.get(m.id) ?? 0;
      return {
        profileId: m.id,
        name: m.display_name ?? 'Onbekend',
        emoji: m.avatar_emoji ?? null,
        count,
        pct: (count / denom) * 100,
      };
    })
    .sort((a, b) => b.count - a.count || (a.profileId < b.profileId ? -1 : a.profileId > b.profileId ? 1 : 0));
}
