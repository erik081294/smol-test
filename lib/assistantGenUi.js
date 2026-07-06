// @ts-check
// Pure interactie-logica van de gen-UI-componenten (AI-16, plan 26).
//
// De renderer (lib/AssistantMessageView.js) blijft een dunne React-schil; alles
// wat te berekenen valt — grafiek-layout, "nice" as-schaal, waarde-formattering,
// porties-herrekening — leeft hier, unit-getest en mutatie-bewaakt. Dit is ook
// de plek waar het A2UI-"data-model"-idee in het klein landt: de node draagt
// gestructureerde data, een pure functie herrekent, React rendert (de bewuste
// AI-7-beslissing uit plan 26: geen wire-protocol nodig voor deze interactie).

/**
 * Rond een maximum op naar een "nice" as-top: 1 / 2 / 2.5 / 5 × 10^k, de
 * kleinste die >= max is. Grafiek-gridlijnen op ronde getallen i.p.v. op
 * 3487 centen. max <= 0 of niet-eindig → 1 (nooit delen door nul).
 * @param {number} max
 * @returns {number}
 */
export function niceMax(max) {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * base >= max) return step * base;
  }
  return 10 * base; // onbereikbaar (10*base >= max per definitie), maar type-veilig
}

/**
 * Chart-punten → tekenbare layout: hoogte-fracties (0..1) t.o.v. een nice
 * as-top + de gridwaarden (helft en top). Negatieve/kapotte waarden klemmen
 * op 0 (uitgaven-grafiek: er bestaat geen negatieve staaf); lege input → null
 * (de renderer laat de grafiek dan weg i.p.v. een lege doos te tekenen).
 * @param {Array<{label:string, value:number}>} [points]
 * @returns {{ bars: Array<{label:string, value:number, frac:number}>, ticks: number[], max: number } | null}
 */
export function chartLayout(points = []) {
  const clean = (Array.isArray(points) ? points : [])
    .map((p) => ({
      label: typeof p?.label === 'string' ? p.label : '',
      value: Number.isFinite(p?.value) && p.value > 0 ? p.value : 0,
    }));
  if (clean.length === 0) return null;
  const max = niceMax(Math.max(...clean.map((p) => p.value)));
  return {
    bars: clean.map((p) => ({ ...p, frac: p.value / max })),
    ticks: [max / 2, max],
    max,
  };
}

/**
 * Grafiekwaarde → compact NL-label. unit 'euro' ⇒ value is in CENTEN (zoals
 * al het geld in de app): afgerond op hele euro's met duizendtallen-punt
 * ("€ 1.250"); elke andere unit ⇒ het getal zelf, afgerond.
 * @param {number} value
 * @param {string|null} [unit]
 * @returns {string}
 */
export function formatChartValue(value, unit = null) {
  const n = Number.isFinite(value) ? value : 0;
  if (unit === 'euro') {
    const euros = Math.round(n / 100);
    return `€ ${String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }
  return String(Math.round(n));
}

/**
 * Hoeveelheid → NL-weergave: max 2 decimalen, zonder zwevende restjes
 * (0.30000000000000004 → "0,3") en zonder loze nullen (2.00 → "2").
 * @param {number} quantity
 * @returns {string}
 */
export function formatQuantity(quantity) {
  if (!Number.isFinite(quantity)) return '';
  const rounded = Math.round(quantity * 100) / 100;
  return String(rounded).replace('.', ',');
}

// Porties-grenzen van de stepper — spiegelt de servings-grens van
// proposeSaveRecipes (1-20) zodat de weergave nooit buiten het domein loopt.
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 20;

/**
 * Stepper-invoer → geldig portie-aantal binnen [MIN_SERVINGS, MAX_SERVINGS].
 * Rommel → MIN_SERVINGS (de kaart toont dan tenminste iets zinnigs).
 * @param {number} n
 * @returns {number}
 */
export function clampServings(n) {
  if (!Number.isInteger(n)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, n));
}

/**
 * Herreken de ingrediëntregels van een recept-kaart voor een ander aantal
 * porties (AI-16-(3): live update, client-lokaal en puur). Alleen regels mét
 * gestructureerde hoeveelheid schalen mee ("naar smaak"-regels houden hun
 * originele tekst); de tekst wordt herbouwd in hetzelfde formaat als de server
 * ("naam · hoeveelheid eenheid"). Gelijke porties of onbruikbare invoer →
 * dezelfde array-referentie terug (geen zinloze re-render).
 * @param {Array<{text:string, name?:string|null, quantity?:number|null, unit?:string|null}>} ingredients
 * @param {number|null|undefined} fromServings de porties waarvoor de hoeveelheden gelden
 * @param {number} toServings het gekozen aantal porties
 * @returns {Array<{text:string, name?:string|null, quantity?:number|null, unit?:string|null}>}
 */
export function scaleIngredients(ingredients, fromServings, toServings) {
  const list = Array.isArray(ingredients) ? ingredients : [];
  const from = Number.isInteger(fromServings) && /** @type {number} */ (fromServings) > 0 ? fromServings : null;
  const to = Number.isInteger(toServings) && toServings > 0 ? toServings : null;
  if (!from || !to || from === to) return list;
  return list.map((ing) => {
    if (!Number.isFinite(ing?.quantity) || /** @type {number} */ (ing.quantity) <= 0 || typeof ing?.name !== 'string' || !ing.name) {
      return ing;
    }
    const scaled = (/** @type {number} */ (ing.quantity) * /** @type {number} */ (to)) / /** @type {number} */ (from);
    const qtyText = formatQuantity(scaled);
    return {
      ...ing,
      quantity: scaled,
      text: `${ing.name} · ${qtyText}${ing.unit ? ` ${ing.unit}` : ''}`,
    };
  });
}
