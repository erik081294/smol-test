// @ts-check
// Tool-pack van de Keuken-module (assistent-skill-file, guidelines §1).
// Lezen (maaltijden_weekmenu, maaltijden_recept_zoeken) en voorstellen
// (maaltijden_plannen, maaltijden_recept_opslaan — beide HITL). De recept-flow
// (AI-12) is stap-voor-stap: éérst zoeken in het receptenboek; bestaat het niet,
// dan stelt de AI een volledig recept voor als recept-kaart en beslist de
// gebruiker — pas daarna inplannen (mét recipe_id) en boodschappen.
// Contract: zie taken.js.

import { addDays, dayLabel, isIsoDate, throwOnError } from './helpers.js';
import { choiceNode, scheduleNode } from './render.js';

export const MEAL_TYPES = ['ontbijt', 'lunch', 'diner', 'snack'];

/**
 * Weekmenu-regels → data + rooster. Verwacht rows gesorteerd op plan_date; de
 * titel komt uit vrije tekst (title) of het gekoppelde recept (recipes.title).
 * Rendert een schedule-node (AI-16, plan 26) met álle dagen van het venster —
 * lege dagen zijn informatie (gaten in het menu). `today` (ctx.today) bepaalt
 * server-side de dagmarkering én het venster; zonder geldige startdatum vallen
 * we terug op alleen de dagen die entries hebben (puur, nooit crashen op data).
 * De `data` naar het model is byte-identiek aan vóór AI-16.
 * @param {Array<{plan_date:string, meal_type?:string|null, title?:string|null, servings?:number|null, recipes?:{title?:string|null}|null}>} [rows]
 * @param {number} [days] hoeveel dagen vooruit er is gekeken (voor de roostertitel)
 * @param {string} [today] startdag van het venster als YYYY-MM-DD (ctx.today)
 */
export function renderWeekMenu(rows = [], days = 7, today = '') {
  const entries = rows.map((r) => ({
    date: r.plan_date,
    meal_type: r.meal_type ?? 'diner',
    title: r.title ?? r.recipes?.title ?? 'Maaltijd',
    servings: r.servings ?? null,
  }));
  const data = { count: entries.length, entries };
  if (entries.length === 0) {
    return { data, render: [{ type: 'card', title: 'Weekmenu', lines: ['Er staat nog niets op het menu.'] }] };
  }
  const entryText = (/** @type {typeof entries[0]} */ e) => {
    const meal = e.meal_type === 'diner' ? '' : ` · ${e.meal_type}`;
    const servings = e.servings ? ` (${e.servings}p)` : '';
    return `${e.title}${servings}${meal}`;
  };
  // Het dag-raster: bij een geldige startdatum álle dagen van het venster
  // (gaten zichtbaar), anders alleen de dagen waarop iets gepland staat.
  const dates = isIsoDate(today)
    ? Array.from({ length: days }, (_, i) => addDays(today, i))
    : [...new Set(entries.map((e) => e.date))];
  const dayRows = dates.map((date) => ({
    label: dayLabel(date),
    today: date === today,
    entries: entries.filter((e) => e.date === date).map((e) => ({ text: entryText(e) })),
  }));
  // Compositie uit het gedeelde vocabulaire (render.js): de text-fallback voor
  // oudere clients (regel per dag mét maaltijden) komt uit de constructor mee.
  return {
    data,
    render: [scheduleNode({ title: `Weekmenu (komende ${days} dagen)`, days: dayRows })],
  };
}

export const MAX_RECIPE_INGREDIENTS = 30;

/**
 * Splits een vrije-tekst-bereiding in losse stappen: op nieuwe regels, met een
 * eventueel "1." / "2)" -nummerprefix eraf. Lege regels vervallen. Puur.
 * @param {string|null|undefined} instructions
 * @returns {string[]}
 */
export function splitSteps(instructions) {
  if (typeof instructions !== 'string') return [];
  return instructions
    .split('\n')
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((s) => s.length > 0);
}

/**
 * Eén recept → recept-kaart (gen-UI-type 'recipe', AI-12): titel, porties,
 * ingrediëntregels ("naam · 2 stuk") en genummerde bereidingsstappen. Puur;
 * de client-poortwachter (lib/assistantUi.js) normaliseert hetzelfde contract.
 * @param {{ title?:string, servings?:number|null, instructions?:string|null,
 *   ingredients?: Array<{name?:string, quantity?:number|null, unit?:string|null}> }} [recipe]
 */
export function renderRecipe(recipe = {}) {
  const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
    .map((ing) => {
      const name = typeof ing?.name === 'string' ? ing.name.trim() : '';
      if (!name) return null;
      const qty = Number.isFinite(ing?.quantity) && /** @type {number} */ (ing.quantity) > 0 ? ing.quantity : null;
      const unit = typeof ing?.unit === 'string' && ing.unit.trim() ? ing.unit.trim() : null;
      // Naast de tekstregel reizen de gestructureerde velden mee (AI-16): die
      // voeden de porties-stepper met live herrekening op de client. Zonder
      // hoeveelheid ("naar smaak") blijft het een kale tekstregel.
      return qty
        ? { text: `${name} · ${qty}${unit ? ` ${unit}` : ''}`, name, quantity: qty, unit }
        : { text: name };
    })
    .filter(Boolean);
  return {
    type: 'recipe',
    title: recipe.title,
    servings: Number.isInteger(recipe.servings) && /** @type {number} */ (recipe.servings) > 0 ? recipe.servings : null,
    ingredients,
    steps: splitSteps(recipe.instructions),
  };
}

/**
 * Zoekresultaat van maaltijden_recept_zoeken → data (met recipe-ids zodat het
 * model kan inplannen) + recept-kaarten. Filtert op titel-substring (case-
 * insensitief); zonder query toont het de eerste paar recepten van het boek.
 * @param {Array<{id:string, title?:string, servings?:number|null, instructions?:string|null,
 *   recipe_ingredients?: Array<{name?:string, quantity?:number|null, unit?:string|null}>}>} [rows]
 * @param {string} [query]
 */
export function renderRecipeMatches(rows = [], query = '') {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  const matched = q ? rows.filter((r) => (r.title ?? '').toLowerCase().includes(q)) : rows;
  const top = matched.slice(0, 3);
  const data = { count: matched.length, matches: top.map((r) => ({ id: r.id, title: r.title ?? null, servings: r.servings ?? null })) };
  if (top.length === 0) {
    const line = q ? `Geen recept gevonden voor "${query}".` : 'Er staan nog geen recepten in het boek.';
    return { data, render: [{ type: 'card', title: 'Recepten', lines: [line] }] };
  }
  const render = /** @type {object[]} */ (top.map((r) => renderRecipe({ title: r.title, servings: r.servings, instructions: r.instructions, ingredients: r.recipe_ingredients })));
  if (top.length >= 2) {
    // Meerdere treffers → beslis-kaart (AI-16): een tik stuurt de keuze als
    // gewone gebruikersbeurt, zodat het model met dát recept verder gaat.
    // Deterministisch server-side gerenderd — het model fabriceert geen opties.
    render.push(choiceNode({
      prompt: 'Welk recept bedoel je?',
      options: top.map((r) => ({
        label: r.title ?? 'Recept',
        description: r.servings ? `voor ${r.servings} personen` : null,
        reply: `Gebruik het recept "${r.title ?? 'Recept'}"`,
      })),
    }));
  }
  return { data, render };
}

export const MAX_PROPOSED_RECIPES = 3;

/**
 * Puur voorstel-bouwwerk van maaltijden_recept_opslaan (AI-12, HITL). Valideert/
 * normaliseert de door de AI bedachte recepten en levert náást items/args ook een
 * `preview`: de rijke recept-kaart(en) die bij het voorstel worden getoond zodat de
 * gebruiker over de inhoud kan beslissen. `items` ↔ `args.items` lopen 1-op-1.
 * @param {{ items?: Array<{title?:string, servings?:number, instructions?:string,
 *   ingredients?: Array<{name?:string, quantity?:number, unit?:string}>}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]}, preview:object[] } | { ok:false, error:string }}
 */
export function proposeSaveRecipes(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen recept om op te slaan.' };
  if (raw.length > MAX_PROPOSED_RECIPES) return { ok: false, error: `Maximaal ${MAX_PROPOSED_RECIPES} recepten per voorstel.` };
  const items = [];
  const norm = [];
  const preview = [];
  for (const it of raw) {
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title) return { ok: false, error: 'Elk recept heeft een titel nodig.' };
    if (title.length > 120) return { ok: false, error: 'Een recepttitel mag maximaal 120 tekens zijn.' };
    const servings = Number.isInteger(it?.servings) && /** @type {number} */ (it.servings) >= 1 && /** @type {number} */ (it.servings) <= 20
      ? /** @type {number} */ (it.servings)
      : 2;
    const rawIng = Array.isArray(it?.ingredients) ? it.ingredients : [];
    if (rawIng.length === 0) return { ok: false, error: `Recept "${title}" heeft minstens één ingrediënt nodig.` };
    if (rawIng.length > MAX_RECIPE_INGREDIENTS) return { ok: false, error: `Een recept mag maximaal ${MAX_RECIPE_INGREDIENTS} ingrediënten hebben.` };
    const ingredients = [];
    for (const ing of rawIng) {
      const name = typeof ing?.name === 'string' ? ing.name.trim() : '';
      if (!name) return { ok: false, error: 'Elk ingrediënt heeft een naam nodig.' };
      if (name.length > 80) return { ok: false, error: 'Een ingrediëntnaam mag maximaal 80 tekens zijn.' };
      const quantity = Number.isFinite(ing?.quantity) && /** @type {number} */ (ing.quantity) > 0 ? ing.quantity : 1;
      const unit = typeof ing?.unit === 'string' && ing.unit.trim() ? ing.unit.trim() : 'stuk';
      ingredients.push({ name, quantity, unit });
    }
    const instructions = typeof it?.instructions === 'string' && it.instructions.trim() ? it.instructions.trim() : null;
    norm.push({ title, servings, ingredients, instructions });
    items.push(`${title} · ${ingredients.length} ingrediënten · ${servings}p`);
    preview.push(renderRecipe({ title, servings, ingredients, instructions }));
  }
  const summary = norm.length === 1 ? `Recept "${norm[0].title}" opslaan` : `${norm.length} recepten opslaan`;
  return { ok: true, summary, items, args: { items: norm }, preview };
}

export const MAX_PROPOSED_MEALS = 14;

// UUID-vorm van een recipe_id uit maaltijden_recept_zoeken — een verzonnen of
// verminkt id faalt al bij propose (duidelijke fout) i.p.v. pas bij execute.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Puur voorstel-bouwwerk van maaltijden_plannen. `items` (weergaveteksten)
 * loopt 1-op-1 met `args.items` voor per-item aan/uitvinken op de bevestigingskaart.
 * `recipe_id` (optioneel, uit maaltijden_recept_zoeken) koppelt de maaltijd aan het
 * receptenboek; alleen aanwezig in de genormaliseerde args als het geldig gezet is.
 * @param {{ items?: Array<{date?:string, meal_type?:string, title?:string, servings?:number, recipe_id?:string}> }} [args]
 * @returns {{ ok:true, summary:string, items:string[], args:{items:object[]} } | { ok:false, error:string }}
 */
export function proposePlanMeals(args = {}) {
  const raw = Array.isArray(args.items) ? args.items : [];
  if (raw.length === 0) return { ok: false, error: 'Geen maaltijden om in te plannen.' };
  if (raw.length > MAX_PROPOSED_MEALS) return { ok: false, error: `Maximaal ${MAX_PROPOSED_MEALS} maaltijden per voorstel.` };
  const items = [];
  const norm = [];
  for (const it of raw) {
    const title = typeof it?.title === 'string' ? it.title.trim() : '';
    if (!title) return { ok: false, error: 'Elke maaltijd heeft een titel nodig.' };
    if (title.length > 120) return { ok: false, error: 'Een maaltijdtitel mag maximaal 120 tekens zijn.' };
    if (!isIsoDate(it?.date ?? '')) return { ok: false, error: `Ongeldige datum: ${it?.date} (gebruik YYYY-MM-DD).` };
    const date = /** @type {string} */ (it.date);
    const mealType = MEAL_TYPES.includes(it?.meal_type ?? '') ? /** @type {string} */ (it.meal_type) : 'diner';
    const servings = Number.isInteger(it?.servings) && /** @type {number} */ (it.servings) >= 1 && /** @type {number} */ (it.servings) <= 12
      ? /** @type {number} */ (it.servings)
      : null;
    if (it?.recipe_id != null && (typeof it.recipe_id !== 'string' || !UUID_RE.test(it.recipe_id))) {
      return { ok: false, error: 'Ongeldig recept-id — zoek het recept eerst op met maaltijden_recept_zoeken.' };
    }
    norm.push({ date, meal_type: mealType, title, servings, ...(it?.recipe_id ? { recipe_id: it.recipe_id } : {}) });
    const meal = mealType === 'diner' ? '' : ` · ${mealType}`;
    items.push(`${dayLabel(date)}${meal} — ${title}${servings ? ` (${servings}p)` : ''}`);
  }
  const summary = norm.length === 1
    ? `"${norm[0].title}" op het menu zetten (${dayLabel(norm[0].date)})`
    : `${norm.length} maaltijden inplannen`;
  return { ok: true, summary, items, args: { items: norm } };
}

// Module-brief (AI-10, guidelines §1): de goedkope altijd-in-context-laag — één
// regel per actieve module in de systemprompt-snapshot (progressive disclosure:
// brief altijd, tool-descriptions als detail, tool-output als derde laag).
export const MAALTIJDEN_BRIEF = {
  moduleKey: 'maaltijden',
  label: 'Keuken',
  brief: 'weekmenu en receptenboek; kan menu en recepten tonen, recepten voorstellen en maaltijden inplannen',
};

export const MAALTIJDEN_TOOLS = [
  {
    name: 'maaltijden_weekmenu',
    moduleKey: 'maaltijden',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Weekmenu erbij pakken…',
    description: 'Roep dit aan wanneer de gebruiker vraagt wat er gegeten wordt, wat er op het menu staat of wat er gepland is om te koken. Haalt het weekmenu op (vandaag + de komende dagen), inclusief gekoppelde recepten.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Hoeveel dagen vooruit (1-14, default 7)' } },
      required: [],
      additionalProperties: false,
    },
    async run(ctx, args = {}) {
      const days = Number.isInteger(args.days) && args.days >= 1 && args.days <= 14 ? args.days : 7;
      const rows = throwOnError(
        await ctx.db
          .from('meal_plan_entries')
          .select('plan_date, meal_type, title, servings, recipes(title)')
          .eq('household_id', ctx.householdId)
          .gte('plan_date', ctx.today)
          .lt('plan_date', addDays(ctx.today, days))
          .order('plan_date', { ascending: true })
          .limit(60)
      );
      return renderWeekMenu(rows, days, ctx.today);
    },
  },
  {
    name: 'maaltijden_plannen',
    moduleKey: 'maaltijden',
    kind: 'write',
    risk: 'write',
    destructive: false, // additief: zet alleen nieuwe maaltijden op het menu
    idempotent: false,  // nogmaals uitvoeren = dubbele menu-regels
    statusLabel: 'Voorstel klaarzetten…',
    description: 'Roep dit aan wanneer de gebruiker een maaltijd op het menu wil zetten (bv. "vrijdag lasagne") — een losse titel volstaat. Hoort er een recept bij (de gebruiker wil koken of de boodschappen erbij)? Geef dan het recipe_id uit maaltijden_recept_zoeken mee; voor kaal inplannen is dat niet nodig. Stelt één of meer maaltijden voor: de gebruiker ziet een bevestigingskaart en kan per maaltijd aan- of uitvinken, er wordt nooit direct iets opgeslagen.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De in te plannen maaltijden (maximaal 14).',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'De dag als YYYY-MM-DD' },
              title: { type: 'string', description: 'Wat er gegeten wordt, bv. "Lasagne"' },
              meal_type: { type: 'string', enum: MEAL_TYPES, description: 'Welk eetmoment (default: diner)' },
              servings: { type: 'integer', description: 'Optioneel aantal eters (1-12)' },
              recipe_id: { type: 'string', description: 'Optioneel: het id van het recept uit maaltijden_recept_zoeken — koppelt de maaltijd aan het receptenboek' },
            },
            required: ['date', 'title'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposePlanMeals,
    async execute(ctx, args) {
      const rows = args.items.map((it) => ({
        household_id: ctx.householdId,
        created_by: ctx.userId,
        plan_date: it.date,
        meal_type: it.meal_type,
        title: it.title,
        ...(it.servings ? { servings: it.servings } : {}),
        ...(it.recipe_id ? { recipe_id: it.recipe_id } : {}),
      }));
      const inserted = throwOnError(await ctx.db.from('meal_plan_entries').insert(rows).select('id'));
      return {
        summary: inserted.length === 1 ? 'Op het weekmenu gezet.' : `${inserted.length} maaltijden op het weekmenu gezet.`,
        inserted: inserted.map((r) => ({ table: 'meal_plan_entries', id: r.id })),
      };
    },
  },
  {
    name: 'maaltijden_recept_zoeken',
    moduleKey: 'maaltijden',
    kind: 'read',
    risk: 'read',
    statusLabel: 'Receptenboek doorbladeren…',
    description: 'Roep dit aan wanneer de gebruiker een gerecht wil kóken, of het recept of de boodschappen ervoor wil: kijk eerst of het al in het receptenboek van het huishouden staat vóórdat je zelf een recept voorstelt. Geeft treffers als recept-kaart, met het recipe_id dat maaltijden_plannen nodig heeft om de maaltijd aan het recept te koppelen. Niet nodig als de gebruiker alleen een titel op het menu wil.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Zoekterm op gerechtnaam, bv. "lasagne" (weglaten = de nieuwste recepten)' } },
      required: [],
      additionalProperties: false,
    },
    async run(ctx, args = {}) {
      const rows = throwOnError(
        await ctx.db
          .from('recipes')
          .select('id, title, servings, instructions, recipe_ingredients(name, quantity, unit)')
          .eq('household_id', ctx.householdId)
          .order('created_at', { ascending: false })
          .limit(100)
      );
      return renderRecipeMatches(rows, args.query);
    },
  },
  {
    name: 'maaltijden_recept_opslaan',
    moduleKey: 'maaltijden',
    kind: 'write',
    risk: 'write',
    destructive: false, // additief: zet alleen nieuwe recepten in het boek
    idempotent: false,  // nogmaals uitvoeren = dubbele recepten
    statusLabel: 'Recept uitschrijven…',
    description: 'Roep dit aan om een recept in het receptenboek te zetten — óf wanneer de gebruiker zelf een recept aanlevert om te bewaren ("sla dit recept op: …"), óf wanneer een gevraagd gerecht nog niet bestaat (controleer dat eerst met maaltijden_recept_zoeken) en jij zelf een volledig recept voorstelt met ingrediënten, porties en bereiding. De gebruiker ziet de recept-kaart en beslist; er wordt nooit direct iets opgeslagen. Plan de maaltijd pas in nadat het recept is goedgekeurd.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'De op te slaan recepten (meestal één, maximaal 3).',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Naam van het gerecht, bv. "Pasta pesto"' },
              servings: { type: 'integer', description: 'Aantal porties (1-20, default 2)' },
              ingredients: {
                type: 'array',
                description: 'De ingrediënten (1-30).',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Ingrediëntnaam, bv. "Penne"' },
                    quantity: { type: 'number', description: 'Hoeveelheid (default 1)' },
                    unit: { type: 'string', description: 'Eenheid, bv. "gram", "el", "stuk" (default "stuk")' },
                  },
                  required: ['name'],
                  additionalProperties: false,
                },
              },
              instructions: { type: 'string', description: 'De bereiding, één stap per regel' },
            },
            required: ['title', 'ingredients'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
    propose: proposeSaveRecipes,
    async execute(ctx, args) {
      // Recept + ingrediënten voor álle voorgestelde recepten in één transactie
      // (DEFINER-RPC save_recipes, migr. 0073). De vorige lus deed losse inserts
      // per recept → een partiële fout liet niet-undobare weesrecepten achter.
      // De RPC geeft de recipe-ids in volgorde terug; die vormen het undo-spoor
      // (de ingrediënten cascaden bij undo mee via on delete cascade).
      const ids = throwOnError(await ctx.db.rpc('save_recipes', {
        p_household_id: ctx.householdId,
        p_items: args.items,
      }));
      const recipeIds = Array.isArray(ids) ? ids : [];
      return {
        summary: recipeIds.length === 1 ? 'Recept opgeslagen in het receptenboek.' : `${recipeIds.length} recepten opgeslagen in het receptenboek.`,
        inserted: recipeIds.map((id) => ({ table: 'recipes', id })),
      };
    },
  },
];

// Manifest (fundament AI-actie-laag): de enige declaratie per module — brief + tools
// in één object. index.js leidt hieruit ASSISTANT_TOOLS/MODULE_BRIEFS af (guidelines §1).
export const MAALTIJDEN_MANIFEST = {
  moduleKey: MAALTIJDEN_BRIEF.moduleKey,
  label: MAALTIJDEN_BRIEF.label,
  brief: MAALTIJDEN_BRIEF.brief,
  tools: MAALTIJDEN_TOOLS,
};
