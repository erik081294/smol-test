// Gedeelde fake RLS-client voor de tool-pack-tests (géén .test.js — de runner
// en groupsCoverage slaan dit bestand over). Honoreert de chain-API van
// supabase-js voor selects én inserts en registreert elke call zodat tests
// tabel/kolommen/filters exact kunnen asserteren.

export function fakeDb(rowsByTable, calls, opts = {}) {
  const chain = (table) => {
    const rec = { table, filters: [], selected: null, inserted: null };
    calls.push(rec);
    const api = {
      select(cols) {
        rec.selected = cols;
        if (rec.inserted) {
          // insert(...).select('id') → teruggegeven ids (of een geforceerde fout).
          if (opts.insertError) return Promise.resolve({ data: null, error: opts.insertError });
          const ids = rec.inserted.map((_, i) => ({ id: `${table}-${i + 1}` }));
          return Promise.resolve({ data: ids, error: null });
        }
        if (rec.updated) {
          // update(...).in('id', ids).select('id') → de ge-update ids (of een fout).
          if (opts.updateError) return Promise.resolve({ data: null, error: opts.updateError });
          const inFilter = rec.filters.find((f) => f[0] === 'in');
          const ids = (inFilter?.[2] ?? []).map((id) => ({ id }));
          return Promise.resolve({ data: ids, error: null });
        }
        return api;
      },
      insert(rows) { rec.inserted = rows; return api; },
      update(patch) { rec.updated = patch; return api; },
      eq(col, val) { rec.filters.push(['eq', col, val]); return api; },
      in(col, vals) { rec.filters.push(['in', col, vals]); return api; },
      is(col, val) { rec.filters.push(['is', col, val]); return api; },
      not(col, op, val) { rec.filters.push(['not', col, op, val]); return api; },
      gt(col, val) { rec.filters.push(['gt', col, val]); return api; },
      gte(col, val) { rec.filters.push(['gte', col, val]); return api; },
      lt(col, val) { rec.filters.push(['lt', col, val]); return api; },
      order(col, o) { rec.order = [col, o]; return api; },
      limit() {
        if (opts.queryError) return Promise.resolve({ data: null, error: opts.queryError });
        return Promise.resolve({ data: rowsByTable[table] ?? [], error: null });
      },
    };
    return api;
  };
  // DEFINER-RPC (bv. save_recipes): registreer de call + args en geef standaard
  // één fake id per p_items-element terug (de vorm die save_recipes retourneert),
  // of een geforceerde fout via opts.rpcError.
  const rpc = (fn, args) => {
    calls.push({ rpc: fn, args });
    if (opts.rpcError) return Promise.resolve({ data: null, error: opts.rpcError });
    const items = Array.isArray(args?.p_items) ? args.p_items : [];
    return Promise.resolve({ data: items.map((_, i) => `recipe-${i + 1}`), error: null });
  };
  return { from: chain, rpc };
}

export const toolCtx = (rowsByTable, calls, opts = {}) => ({
  db: fakeDb(rowsByTable, calls, opts),
  householdId: 'h1',
  userId: 'u1',
  today: '2026-07-04',
  memberNames: { u1: 'Erik', u2: 'Sam' },
});
