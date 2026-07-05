// @ts-check
// Tool-registry van de Huishoek Assistent (AI-1, plan 23 §2). Eén bron van waarheid
// voor wat de agent KAN: per tool een naam, JSON-schema, moduleKey (voor filtering op
// ingeschakelde modules) en een `run(ctx, args)`.
//
// Ontwerpregels:
//  - `ctx.db` is ALTIJD de RLS-gebonden Supabase-client (user-JWT): elke query is
//    automatisch beperkt tot het huishouden én de zichtbaarheid van de vrager.
//    Tools filteren dus nooit zelf op "mag ik dit zien" — dat doet de database.
//  - De `render`-tree per tool wordt hier DETERMINISTISCH gebouwd (geen model-inbreng):
//    prompt-injectie via data kan geen UI fabriceren (plan 23 §5). Nodes komen uit de
//    vaste catalog van lib/assistantUi.js.
//  - De pure `render*`/`summarize*`-helpers staan los van `run` zodat ze met node:test
//    unit-getest en mutatie-bewaakt zijn; `run` is een dunne query + helper-compositie.
//  - v1 = alleen read-tools. Write-tools (fase 3) krijgen `kind: 'write'` en worden
//    door de schil nooit uitgevoerd maar als proposed_action teruggegeven.

const fmtEuro = (cents) => `€ ${(cents / 100).toFixed(2).replace('.', ',')}`;

/**
 * Open taken → data + kaart. Sorteert op due_date (zonder datum achteraan).
 * @param {Array<{title:string, due_date?:string|null, assigned_to?:string|null}>} [rows]
 * @param {Record<string,string>} [names] profiel-id → weergavenaam
 */
export function renderOpenTasks(rows = [], names = {}) {
  const sorted = [...rows].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
  });
  const items = sorted.map((t) => {
    const who = t.assigned_to ? names[t.assigned_to] : null;
    const parts = [t.title, t.due_date ?? null, who ?? null].filter(Boolean);
    return { text: parts.join(' · ') };
  });
  const data = { count: rows.length, tasks: sorted.map((t) => ({ title: t.title, due_date: t.due_date ?? null, assignee: (t.assigned_to && names[t.assigned_to]) || null })) };
  const render = items.length > 0
    ? [{ type: 'list', title: `Open taken (${items.length})`, items }]
    : [{ type: 'card', title: 'Open taken', lines: ['Niets open — lekker bezig!'] }];
  return { data, render };
}

/**
 * Boodschappenlijst (onafgevinkt) → data + kaart.
 * @param {Array<{name:string, quantity?:string|null}>} [rows]
 */
export function renderGroceryList(rows = []) {
  const items = rows.map((g) => ({ text: g.quantity ? `${g.name} (${g.quantity})` : g.name }));
  const data = { count: rows.length, items: rows.map((g) => ({ name: g.name, quantity: g.quantity ?? null })) };
  const render = items.length > 0
    ? [{ type: 'list', title: `Boodschappenlijst (${items.length})`, items }]
    : [{ type: 'card', title: 'Boodschappenlijst', lines: ['De lijst is leeg.'] }];
  return { data, render };
}

/**
 * Uitgaven-samenvatting van één maand → totalen per categorie-loos overzicht.
 * @param {Array<{description:string, amount_cents:number, spent_on:string}>} [rows]
 * @param {string} [monthLabel] bv. "juli 2026"
 */
export function renderExpensesSummary(rows = [], monthLabel = '') {
  const total = rows.reduce((sum, e) => sum + (e.amount_cents ?? 0), 0);
  const top = [...rows]
    .sort((a, b) => (b.amount_cents ?? 0) - (a.amount_cents ?? 0))
    .slice(0, 3)
    .map((e) => ({ k: e.description, v: fmtEuro(e.amount_cents ?? 0) }));
  const title = monthLabel ? `Uitgaven ${monthLabel}` : 'Uitgaven';
  const data = { count: rows.length, total_cents: total };
  if (rows.length === 0) return { data, render: [{ type: 'card', title, lines: ['Geen uitgaven gevonden.'] }] };
  return {
    data,
    render: [{
      type: 'keyvalue',
      title,
      pairs: [{ k: 'Totaal', v: fmtEuro(total) }, { k: 'Aantal', v: String(rows.length) }, ...top],
    }],
  };
}

/**
 * Voorraad die onder de drempel zit of (bijna) over datum is.
 * "Bijna op" = quantity <= low_threshold (alleen als er een drempel is gezet);
 * "let op houdbaarheid" = best_before op of vóór `horizon` (YYYY-MM-DD).
 * @param {Array<{name:string, quantity:number, low_threshold?:number|null, best_before?:string|null}>} [rows]
 * @param {string} [horizon]
 */
export function lowPantryItems(rows = [], horizon = '') {
  return rows.filter((p) => {
    const low = p.low_threshold != null && p.quantity <= p.low_threshold;
    const expiring = Boolean(horizon) && p.best_before != null && p.best_before <= horizon;
    return low || expiring;
  });
}

/** @param {Array<{name:string, quantity:number, unit?:string|null}>} [rows] */
export function renderPantryLow(rows = []) {
  const items = rows.map((p) => ({ text: `${p.name} (${p.quantity} ${p.unit ?? 'stuk'})` }));
  const data = { count: rows.length, items: rows.map((p) => p.name) };
  const render = items.length > 0
    ? [{ type: 'list', title: 'Bijna op / let op houdbaarheid', items }]
    : [{ type: 'card', title: 'Voorraad', lines: ['Alles is voldoende op voorraad.'] }];
  return { data, render };
}

// ---------------------------------------------------------------------------
// De registry. `run(ctx, args)`-contract: ctx = { db, householdId, userId, today }
// met `db` de RLS-gebonden supabase-js-client en `today` een YYYY-MM-DD-string
// (de schil geeft 'm door; puur houden = geen new Date() hier).
// Bij een query-fout gooit run — de schil vertaalt dat naar { error } als
// tool-resultaat zodat het model netjes kan reageren.
// ---------------------------------------------------------------------------

const throwOnError = ({ data, error }) => {
  if (error) throw new Error(error.message ?? 'query mislukt');
  return data ?? [];
};

export const ASSISTANT_TOOLS = [
  {
    name: 'get_open_tasks',
    moduleKey: 'taken',
    kind: 'read',
    statusLabel: 'Even in de taken kijken…',
    description: 'Haal de open (niet-afgeronde) taken van het huishouden op, optioneel alleen die van de vrager.',
    parameters: {
      type: 'object',
      properties: { only_mine: { type: 'boolean', description: 'Alleen taken die aan de vrager zijn toegewezen' } },
      required: [],
    },
    async run(ctx, args = {}) {
      let q = ctx.db
        .from('tasks')
        .select('title, due_date, assigned_to')
        .eq('household_id', ctx.householdId)
        .is('completed_at', null);
      if (args.only_mine === true) q = q.eq('assigned_to', ctx.userId);
      const rows = throwOnError(await q.order('due_date', { ascending: true, nullsFirst: false }).limit(50));
      return renderOpenTasks(rows, ctx.memberNames ?? {});
    },
  },
  {
    name: 'get_grocery_list',
    moduleKey: 'boodschappen',
    kind: 'read',
    statusLabel: 'Boodschappenlijstje erbij pakken…',
    description: 'Haal de actuele (onafgevinkte) boodschappenlijst op.',
    parameters: { type: 'object', properties: {}, required: [] },
    async run(ctx) {
      const rows = throwOnError(
        await ctx.db
          .from('groceries')
          .select('name, quantity')
          .eq('household_id', ctx.householdId)
          .eq('checked', false)
          .order('created_at', { ascending: true })
          .limit(100)
      );
      return renderGroceryList(rows);
    },
  },
  {
    name: 'get_expenses_summary',
    moduleKey: 'kosten',
    kind: 'read',
    statusLabel: 'Uitgaven op een rijtje zetten…',
    description: 'Samenvatting van de uitgaven in een maand (default: de maand van vandaag). month als "YYYY-MM".',
    parameters: {
      type: 'object',
      properties: { month: { type: 'string', description: 'Maand als YYYY-MM, bv. 2026-07' } },
      required: [],
    },
    async run(ctx, args = {}) {
      const month = /^\d{4}-\d{2}$/.test(args.month ?? '') ? args.month : ctx.today.slice(0, 7);
      const rows = throwOnError(
        await ctx.db
          .from('expenses')
          .select('description, amount_cents, spent_on')
          .eq('household_id', ctx.householdId)
          .gte('spent_on', `${month}-01`)
          .lt('spent_on', nextMonth(month))
          .limit(500)
      );
      return renderExpensesSummary(rows, month);
    },
  },
  {
    name: 'get_pantry_low_stock',
    moduleKey: 'voorraad',
    kind: 'read',
    statusLabel: 'Voorraad nalopen…',
    description: 'Welke voorraad-items zijn bijna op of lopen binnen een week tegen de houdbaarheidsdatum aan?',
    parameters: { type: 'object', properties: {}, required: [] },
    async run(ctx) {
      const rows = throwOnError(
        await ctx.db
          .from('pantry_items')
          .select('name, quantity, unit, low_threshold, best_before')
          .eq('household_id', ctx.householdId)
          .limit(300)
      );
      return renderPantryLow(lowPantryItems(rows, addDays(ctx.today, 7)));
    },
  },
];

/**
 * "YYYY-MM" → eerste dag van de volgende maand ("YYYY-MM-01"), zuivere string-
 * rekensom (geen Date, dus geen tijdzone-verrassingen). December rolt het jaar door.
 * @param {string} month
 */
export function nextMonth(month) {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m >= 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * YYYY-MM-DD + n dagen, via UTC zodat de uitkomst niet van de servertijdzone afhangt.
 * @param {string} isoDate
 * @param {number} days
 */
export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
