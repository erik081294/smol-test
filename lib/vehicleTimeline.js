// @ts-check
// Pure, testbare logica voor het onderhoudsboekje (V2). Géén React/Supabase.
//
// Het boekje is één tijdlijn die drie bronnen samenvoegt, nieuwste eerst:
//   1. vehicle_log     — handmatig gelogd onderhoud, km-standen en notities (met foto)
//   2. afgevinkte taken — voltooide onderhoudstaken van dit voertuig (task_completions)
//   3. RDW-mijlpalen    — datum eerste toelating ("in gebruik genomen")
// De hook (lib/useVehicles.js) haalt de bronnen op; deze helpers mappen + sorteren +
// groeperen per dag, en bouwen een exporteerbaar boekje voor bij de verkoop.

// Lokale kalenderdag-sleutel (yyyy-MM-dd) van een ISO-string/Date. Lokaal: de gebruiker
// denkt in "vandaag". Null bij een ongeldige/lege datum.
// Een datum-only ISO-string ('2026-06-01') ís al een kalenderdag; we geven 'm normalised
// terug zonder new Date(), want die parst 'm als UTC-middernacht en verschuift 'm in
// negatieve-offset-tijdzones een dag terug. Volledige timestamps lezen we lokaal af.
export function dayKeyOf(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Relatieve dag-aanduiding t.o.v. `now`, puur op dag-sleutels. -> 'today' | 'yesterday'
// | null (toon dan de absolute datum). Spiegelt lib/plantTimeline.js.
export function relativeDayLabel(dayKey, now = new Date()) {
  const today = dayKeyOf(now);
  if (!dayKey || !today) return null;
  if (dayKey === today) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === dayKeyOf(yesterday)) return 'yesterday';
  return null;
}

// Soort van een vehicle_log-rij, afgeleid uit wat is ingevuld: kosten/titel → onderhoud,
// alléén km → km-stand, anders een notitie. Bepaalt het icoon/label in de tijdlijn.
export function logEntryKind(row) {
  if (!row) return 'note';
  if ((row.cost_cents != null && row.cost_cents > 0) || row.title) return 'onderhoud';
  if (row.mileage != null && !row.note && !row.photo_path) return 'km';
  return 'note';
}

// Sorteersleutel: een dag-string (yyyy-MM-dd) volstaat voor nieuwste-eerst. Ontbrekend → ''.
const sortKey = (e) => dayKeyOf(e.date) ?? '';

// Voeg de drie bronnen samen tot één genormaliseerde, nieuwste-eerst-gesorteerde lijst.
//   logs:        [{ id, performed_on, title, mileage, cost_cents, note, photo_path }]
//   completions: [{ id, completed_at, task:{ title } }]
//   vehicle:     { first_registration }
// -> [{ id, date, kind, title, mileage?, cost_cents?, note?, photo_path? }]
/** @param {{ logs?: Array<{id?: any, performed_on?: string, title?: string, mileage?: number, cost_cents?: number, note?: string, photo_path?: string}>, completions?: Array<{id?: any, completed_at?: string, task?: {title?: string}}>, vehicle?: {first_registration?: string|Date|null} }} [opts] */
export function buildVehicleTimeline({ logs = [], completions = [], vehicle = {} } = {}) {
  const out = [];
  for (const r of logs) {
    out.push({
      id: `log:${r.id}`, date: r.performed_on, kind: logEntryKind(r),
      title: r.title || null, mileage: r.mileage ?? null,
      cost_cents: r.cost_cents ?? null, note: r.note || null, photo_path: r.photo_path || null,
    });
  }
  for (const c of completions) {
    out.push({
      id: `done:${c.id}`, date: c.completed_at, kind: 'taak',
      title: c.task?.title || null, mileage: null, cost_cents: null, note: null, photo_path: null,
    });
  }
  if (vehicle.first_registration) {
    out.push({
      id: `rdw:first`, date: vehicle.first_registration, kind: 'mijlpaal',
      title: 'Eerste toelating (RDW)', mileage: null, cost_cents: null, note: null, photo_path: null,
    });
  }
  // Nieuwste eerst; entries zonder geldige datum zakken naar onderen (lege sleutel).
  return out.sort((a, b) => (sortKey(a) < sortKey(b) ? 1 : sortKey(a) > sortKey(b) ? -1 : 0));
}

// Groepeer een al-gesorteerde tijdlijn per kalenderdag (volgorde blijft behouden).
// -> [{ key:'2026-06-22', entries:[...] }, ...]
export function groupVehicleTimelineByDay(entries) {
  const groups = [];
  /** @type {{ key: string, entries: any[] } | null} */
  let current = null;
  for (const e of entries ?? []) {
    const key = dayKeyOf(e?.date) ?? 'onbekend';
    if (!current || current.key !== key) { current = { key, entries: [] }; groups.push(current); }
    current.entries.push(e);
  }
  return groups;
}

// Som van de gelogde kosten (centen), ontbrekend → 0. Voor het totaal in het boekje.
export function totalLoggedCents(logs = []) {
  return logs.reduce((sum, r) => sum + (r.cost_cents ?? 0), 0);
}

// Centen → "€ 1.234,56" (NL, deterministisch — geen Intl/locale in de units).
function euro(cents) {
  const neg = cents < 0;
  const v = Math.abs(cents);
  const whole = String(Math.floor(v / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const frac = String(v % 100).padStart(2, '0');
  return `${neg ? '-' : ''}€ ${whole},${frac}`;
}

// Exporteerbaar onderhoudsboekje als platte tekst (voor delen bij verkoop). Chronologisch
// (oudste eerst — leest als een servicehistorie). Entries mogen in elke volgorde binnenkomen.
export function buildLogbookText(vehicle = {}, entries = []) {
  const head = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const idLine = [head, vehicle.license_plate, vehicle.year ? `bouwjaar ${vehicle.year}` : null]
    .filter(Boolean).join(' · ');
  const lines = [`Onderhoudsboekje — ${vehicle.name ?? 'voertuig'}`];
  if (idLine) lines.push(idLine);
  lines.push('');

  const chrono = [...entries].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
  if (chrono.length === 0) {
    lines.push('Nog geen onderhoud gelogd.');
  } else {
    for (const e of chrono) {
      const day = dayKeyOf(e.date);
      const date = day ? day.split('-').reverse().join('-') : '—';
      const bits = [
        e.title || (e.kind === 'km' ? 'Km-stand' : 'Notitie'),
        e.mileage != null ? `${e.mileage} km` : null,
        e.cost_cents != null ? euro(e.cost_cents) : null,
      ].filter(Boolean).join(' · ');
      lines.push(`${date} — ${bits}`);
      if (e.note) lines.push(`   ${e.note}`);
    }
  }
  return lines.join('\n');
}
