// @ts-check
// Pure logica voor de OFF-catalogus delta-refresh (geen IO — los testbaar).
// OFF publiceert dagelijkse delta-bestanden (14 dagen bewaard) met in de naam de
// UNIX-timestamps van de eerste en laatste wijziging in dat bestand. We passen alleen
// nog-niet-verwerkte delta's toe (op volgorde) en detecteren een "gat": als ons
// watermerk ouder is dan de oudste beschikbare delta, dekken de 14-daagse delta's het
// niet meer → een volle her-import is nodig (delta's bevatten ook geen verwijderingen).

// Index (één bestandsnaam per regel) → array van bestandsnamen.
export function parseDeltaIndex(text) {
  return String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Bestandsnaam → { from, to } UNIX-seconden (eerste/laatste wijziging), of null.
// We pakken alle getallen van 9+ cijfers (epoch-seconden) uit de naam; min=from, max=to.
export function deltaTimestamps(filename) {
  const nums = String(filename || '').match(/\d{9,}/g);
  if (!nums || nums.length < 2) return null;
  const ts = nums.map(Number).filter(Number.isFinite);
  if (ts.length < 2) return null;
  return { from: Math.min(...ts), to: Math.max(...ts) };
}

// Kies de nog niet-toegepaste delta's t.o.v. een watermerk.
//   filenames: regels uit de index
//   watermark: grootste reeds verwerkte 'to'-timestamp (0 = nog nooit gesynct)
// → { pending: [{filename, from, to}] (oplopend op `to`), gap: bool, total: int }
export function selectNewDeltas(filenames = [], watermark = 0) {
  const parsed = (filenames || [])
    .map((f) => { const ts = deltaTimestamps(f); return ts ? { filename: f, ...ts } : null; })
    .filter(Boolean)
    .sort((a, b) => a.to - b.to || (a.filename < b.filename ? -1 : 1));

  const pending = parsed.filter((d) => d.to > watermark);
  // Gat: we hebben eerder gesynct (watermark>0) maar zelfs de vroegst gedekte wijziging
  // ligt ná ons watermerk → er zit een niet-gedekt gat tussen (volle her-import nodig).
  // Let op: neem het MINIMUM `from` over alle delta's; `parsed` is op `to` gesorteerd, dus
  // parsed[0] is niet per se de delta die het vroegst begint (overlappende vensters).
  const oldestFrom = parsed.length ? Math.min(...parsed.map((d) => d.from)) : 0;
  const gap = watermark > 0 && parsed.length > 0 && oldestFrom > watermark;

  return { pending, gap, total: parsed.length };
}
