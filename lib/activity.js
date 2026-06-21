// Pure kern van de activiteitenfeed (PLT-6): zet genormaliseerde events om naar een
// NL-regel + icoon, en formatteert relatieve tijd. Bron-agnostisch (een registry per
// event-type) zodat we later naast taakvoltooiingen ook uitgaven/bonnen kunnen voeden,
// net als de event-router in supabase/functions/notify/core.js. Géén React/IO hier.

// Relatieve tijd in het Nederlands, deterministisch (testbaar). `now` injecteerbaar.
export function relativeTime(at, now = Date.now()) {
  const t = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (!Number.isFinite(t)) return '';
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return 'zojuist';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min geleden`;
  const uur = Math.floor(min / 60);
  if (uur < 24) return `${uur} uur geleden`;
  const dag = Math.floor(uur / 24);
  if (dag === 1) return 'gisteren';
  if (dag < 7) return `${dag} dagen geleden`;
  const wk = Math.floor(dag / 7);
  return `${wk} wk geleden`;
}

const q = (s) => `'${s}'`;

// Registry: event-type → (event) => { icon, text } | null. Eén plek om regels toe te
// voegen; onbekende types leveren null (worden uit de feed gefilterd).
const FORMATTERS = {
  task_completed: (e) => {
    const actor = e.actorName?.trim() || 'Iemand';
    const title = e.taskTitle?.trim();
    if (!title) return null;
    return { icon: 'check', text: `${actor} vinkte ${q(title)} af` };
  },
};

// Eén event → feed-item (of null als niet te tonen). Verwacht een genormaliseerd event:
//   { id, type, at, actorName, ...type-specifiek }
export function formatActivity(event, now = Date.now()) {
  const fmt = event && FORMATTERS[event.type];
  if (!fmt) return null;
  const base = fmt(event);
  if (!base) return null;
  return { id: event.id, at: event.at, when: relativeTime(event.at, now), ...base };
}

// Een lijst ruwe events → gesorteerde, geformatteerde feed (nieuwste eerst).
export function buildFeed(events = [], now = Date.now()) {
  return events
    .map((e) => formatActivity(e, now))
    .filter(Boolean)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
