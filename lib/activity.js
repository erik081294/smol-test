// @ts-check
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
  task_completed: (e, count = 1) => {
    const actor = e.actorName?.trim() || 'Iemand';
    const title = e.taskTitle?.trim();
    if (!title) return null;
    const times = count > 1 ? ` ${count}×` : '';
    return { icon: 'check', text: `${actor} vinkte ${q(title)}${times} af` };
  },
};

// Sleutel waarop opeenvolgende events samenvouwen: zelfde lid, zelfde actie op hetzelfde
// object. Eén plek, zodat het consistent blijft met de FORMATTERS-tekst.
const groupKey = (e) => `${e.type}|${e.actorName ?? ''}|${e.taskTitle ?? ''}`;

// Eén event → feed-item (of null als niet te tonen). Verwacht een genormaliseerd event:
//   { id, type, at, actorName, ...type-specifiek }
// `count` > 1 vouwt N identieke acties samen tot één regel ("… 3× af").
export function formatActivity(event, now = Date.now(), count = 1) {
  const fmt = event && FORMATTERS[event.type];
  if (!fmt) return null;
  const base = fmt(event, count);
  if (!base) return null;
  const item = { id: event.id, at: event.at, when: relativeTime(event.at, now), ...base };
  if (count > 1) item.count = count;
  return item;
}

// Een lijst ruwe events → gesorteerde, geformatteerde feed (nieuwste eerst). Opeenvolgende
// identieke acties (zelfde lid + zelfde taak) vouwen samen tot één regel met teller, zodat
// een vaak-afgevinkte terugkerende taak de feed niet overspoelt. Alleen aaneengesloten
// gelijke events vouwen samen — iets anders ertussen begint een nieuwe groep.
export function buildFeed(events = [], now = Date.now()) {
  const sorted = events
    .filter((e) => e && FORMATTERS[e.type])
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const groups = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.key === groupKey(e)) last.count += 1;
    else groups.push({ key: groupKey(e), event: e, count: 1 });
  }
  return groups
    .map((g) => formatActivity(g.event, now, g.count))
    .filter(Boolean);
}
