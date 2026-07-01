// Rooktest-opruimer (INF-3): verwijder de `E2E…`-testrijen die de behavior-flows aanmaken,
// zodat een rooktest geen testdata opstapelt. Deterministisch op DB-niveau i.p.v. via de UI —
// de app verwijdert undo-toast-gestuurd (op timer), wat na `router.back()` uit een editor niet
// betrouwbaar afvuurt, dus we ruimen hier zelf op.
//
// Draait met de service-role-key (bypasst RLS) uit .env; de runner roept 'm aan met
// `node --env-file=.env`. Scope is strikt `… like 'E2E%'` op het test-huishouden.
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('  (cleanup overgeslagen: EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreekt)');
  process.exit(0);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

try {
  // expense_shares eerst (FK naar expenses), dan de rest.
  const { data: exp } = await sb.from('expenses').select('id').like('description', 'E2E%');
  const ids = (exp ?? []).map((e) => e.id);
  if (ids.length) await sb.from('expense_shares').delete().in('expense_id', ids);

  const targets = [
    ['expenses', 'description'],
    ['tasks', 'title'],
    ['groceries', 'name'],
  ];
  let total = 0;
  for (const [table, col] of targets) {
    const { data, error } = await sb.from(table).delete().like(col, 'E2E%').select('id');
    if (error) { console.log(`  ⚠ ${table}: ${error.message}`); continue; }
    total += data?.length ?? 0;
  }
  console.log(`  ✓ E2E-testdata opgeruimd (${total} rij(en) + ${ids.length} expense_share(s))`);
} catch (e) {
  console.log(`  ⚠ cleanup mislukt: ${e.message}`);
}
