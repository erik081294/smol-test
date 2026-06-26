// Pure, testbare helpers voor de cross-plant tijdlijn (PLA-8). Geen React/Supabase.
//
// De cross-plant tijdlijn is een weergavelaag over `plant_photos` (foto's én losse
// notities), nieuwste eerst, over álle zichtbare planten heen. RLS heeft de
// zichtbaarheid al gefilterd voordat dit draait; deze helpers groeperen alleen op
// kalenderdag zodat de feed rustige dag-kopjes ("Vandaag", "Gisteren", datum) toont
// zonder de nieuwste-eerst-volgorde te breken.

// Lokale kalenderdag-sleutel (yyyy-MM-dd) van een ISO-timestamp of Date. Bewust
// lokaal: de gebruiker denkt in "vandaag", niet in UTC. Null bij een ongeldige datum.
// Een datum-only ISO-string ('2026-06-01') ís al een kalenderdag; we geven 'm normalised
// terug zonder new Date(), want die parst 'm als UTC-middernacht en verschuift 'm in
// negatieve-offset-tijdzones een dag terug. Volledige timestamps lezen we lokaal af.
export function dayKeyOf(value) {
  if (value == null || value === '') return null; // new Date(null) → epoch, niet Invalid
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

// Groepeer tijdlijn-entries op kalenderdag. Verwacht entries die al nieuwste-eerst
// gesorteerd zijn (zoals de hook ze levert) en behoudt die volgorde binnen én tussen
// groepen. Entries zonder geldige datum vallen in een 'onbekend'-groep onderaan.
// -> [{ key:'2026-06-22', entries:[...] }, ...]
export function groupTimelineByDay(entries) {
  const groups = [];
  let current = null;
  for (const e of entries ?? []) {
    const key = dayKeyOf(e?.created_at) ?? 'onbekend';
    if (!current || current.key !== key) {
      current = { key, entries: [] };
      groups.push(current);
    }
    current.entries.push(e);
  }
  return groups;
}

// Relatieve dag-aanduiding t.o.v. `now`, puur op kalenderdag-sleutels (geen
// tijdzone-parsing). -> 'today' | 'yesterday' | null. Null = toon de absolute datum.
export function relativeDayLabel(dayKey, now = new Date()) {
  const today = dayKeyOf(now);
  if (!dayKey || !today) return null;
  if (dayKey === today) return 'today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === dayKeyOf(yesterday)) return 'yesterday';
  return null;
}
