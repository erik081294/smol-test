// @ts-check
// Pure, testbare logica voor incrementeel realtime-patchen (INF-8 C3). Géén
// React/Supabase. Vervangt voor platte `select:'*'`-collecties de full refetch
// per realtime-event door een lokale lijst-mutatie: sneller (geen netwerk-round-
// trip) en lichter op de DB. Hooks met een join-select (zone/shares) gebruiken dit
// bewust níét — een postgres_changes-payload draagt de geëmbedde relatie niet mee,
// dus daar zou een patch de join verliezen; die blijven reload-on-event.
//
// Robuustheid: kan een patch niet betrouwbaar worden bepaald (geen id in de
// payload, onbekend event), dan geeft applyRealtimePatch() `null` terug — het
// signaal voor de aanroeper om alsnog een volledige reload te doen.

// Bouwt een vergelijkfunctie uit de bestaande `order`-spec van useCollection
// (`[{ column, ascending?, nullsFirst? }]`), zodat een gepatchte lijst dezelfde
// volgorde houdt als een verse server-fetch. Spiegelt Postgres' standaard:
// ASC → NULLS LAST, DESC → NULLS FIRST (tenzij `nullsFirst` expliciet gezet is).
export function comparatorFromOrder(order = []) {
  return (a, b) => {
    for (const o of order) {
      const col = o.column;
      const asc = o.ascending ?? true;
      const nullsFirst = o.nullsFirst ?? !asc;
      const av = a?.[col];
      const bv = b?.[col];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) continue;
      if (aNull) return nullsFirst ? -1 : 1;
      if (bNull) return nullsFirst ? 1 : -1;
      let cmp = 0;
      if (av < bv) cmp = -1;
      else if (av > bv) cmp = 1;
      if (cmp !== 0) return asc ? cmp : -cmp;
    }
    return 0;
  };
}

const sorted = (arr, comparator) => [...arr].sort(comparator);

// Past één realtime-event toe op de lokale lijst en geeft een NIEUWE array terug
// (of `null` = "kon niet patchen, doe een full reload"). `payload` is de
// supabase-js postgres_changes-payload: { eventType, new, old }.
export function applyRealtimePatch(items, payload, comparator) {
  const type = payload?.eventType;
  const newRow = payload?.new;
  const oldRow = payload?.old;

  if (type === 'INSERT') {
    const id = newRow?.id;
    if (id == null) return null;
    // Idempotent t.o.v. de realtime-echo van een eigen create / een dubbel event.
    if (items.some((it) => it.id === id)) return items;
    return sorted([...items, newRow], comparator);
  }

  if (type === 'UPDATE') {
    const id = newRow?.id;
    if (id == null) return null;
    const exists = items.some((it) => it.id === id);
    // Volledige rij vervangen (select '*'); kwam de rij nieuw in beeld (bv. een
    // wijziging die 'm binnen de RLS-/filter-scope bracht), dan invoegen.
    const next = exists
      ? items.map((it) => (it.id === id ? newRow : it))
      : [...items, newRow];
    return sorted(next, comparator);
  }

  if (type === 'DELETE') {
    // Default replica identity levert minstens de primary key in `old`.
    const id = oldRow?.id ?? newRow?.id;
    if (id == null) return null;
    return items.filter((it) => it.id !== id);
  }

  return null;
}
