// @ts-check
// Pure filterkern van de tijdlijn (TML-6, plan 19): beslist of een feed-item
// (systeem-event of bericht) zichtbaar is op basis van de twee filter-lagen —
// huishouden (owner zet de basis) en gebruiker (verfijnt voor zichzelf).
// Gemodelleerd naar effectiveModules in lib/modules.js: DEFAULT-ON (zichtbaar
// tenzij expliciet uitgezet) en een huishouden-uitzetting wint van de gebruiker —
// staat een waarde in één van beide lijsten, dan is 'ie verborgen, dus een lid kan
// een huishouden-uitzetting nooit terugzetten. Géén React/Supabase/IO hier.
//
// De data leeft in household_timeline_prefs / user_timeline_prefs (migratie 0076):
// één rij per (as, waarde) met enabled=false als expliciete uitzetting. Dit is een
// wéérgave-filter, geen beveiliging — de RLS doet de echte afscherming.

// De vier filter-assen uit het ontwerp. 'subgroup' (TML-8) staat alvast in het
// DB-CHECK maar heeft hier nog geen beslislogica; 'member' (TML-7) is de
// per-lid-as (waarde = profiel-id, want weergavenamen zijn niet uniek/stabiel).
export const TIMELINE_FILTER_AXES = ['module', 'event_type', 'member', 'subgroup'];

// Welke module elk systeem-event voedt (de module-as verbergt per bron-module).
// Sleutels = de FORMATTERS-types in lib/activity.js; waarden = module-keys uit
// lib/modules.js. Nieuw event-type in de feed? Voeg 'm hier (en in de i18n-labels
// van het filterscherm) toe, anders valt 'ie buiten de module-as.
export const EVENT_TYPE_MODULE = {
  task_completed: 'taken',
  expense_added: 'kosten',
  grocery_added: 'boodschappen',
  plant_added: 'planten',
  pet_added: 'huisdieren',
  vehicle_added: 'voertuigen',
};

// Afgeleide lijsten voor het filterscherm: alle filterbare event-types en de
// (ontdubbelde) modules die de tijdlijn voeden, in vaste volgorde.
export const TIMELINE_EVENT_TYPES = Object.keys(EVENT_TYPE_MODULE);
export const TIMELINE_FILTER_MODULES = [...new Set(Object.values(EVENT_TYPE_MODULE))];

/**
 * De module-key achter een event-type ('grocery_added' → 'boodschappen');
 * onbekend type → undefined (valt dan alleen onder de event_type-as).
 * @param {string} [type]
 * @returns {string | undefined}
 */
export function moduleForEventType(type) {
  return type == null ? undefined : EVENT_TYPE_MODULE[type];
}

// Zet de ruwe pref-rijen ({ axis, value, enabled }) om naar de uitgezette waarden
// per as: { module: ['kosten'], event_type: [...] }. DEFAULT-ON: alleen rijen met
// expliciet enabled=false tellen; ontbrekende/kapotte rijen worden overgeslagen.
/**
 * @param {({ axis?: *, value?: *, enabled?: * } | null)[]} [rows]
 * @returns {Record<string, string[]>}
 */
export function disabledByAxis(rows = []) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const r of rows) {
    if (!r || r.enabled !== false) continue;
    if (typeof r.axis !== 'string' || typeof r.value !== 'string') continue;
    (out[r.axis] ??= []).push(r.value);
  }
  return out;
}

// Staat deze waarde in de uitgezette lijst van die as? Null-veilig: geen lijst → nee.
/**
 * @param {Record<string, string[]>} disabled
 * @param {string} axis
 * @param {string} value
 */
function axisDisabled(disabled, axis, value) {
  const list = disabled?.[axis];
  return Array.isArray(list) && list.includes(value);
}

/**
 * Beslist of een tijdlijn-item zichtbaar is onder de twee filter-lagen.
 * `item` draagt per as zijn waarde: `{ module, eventType, member }` — een
 * handgeschreven bericht heeft geen eventType en valt dus alleen onder assen die
 * het wél draagt. `member` (TML-7) is het profiel-id van de maker/actor: op een
 * post de auteur, op een systeem-event wie de actie deed.
 * DEFAULT-ON: zonder config (of zonder uitzettingen) is álles zichtbaar; een
 * uitzetting op huishouden- óf gebruikersniveau verbergt — huishouden wint dus
 * vanzelf van een gebruiker die niets heeft uitgezet.
 * @param {{ module?: string, eventType?: string, member?: string } | null} [item]
 * @param {{ householdDisabled?: Record<string, string[]>, userDisabled?: Record<string, string[]> }} [config]
 * @returns {boolean}
 */
export function visibleOnTimeline(item, { householdDisabled = {}, userDisabled = {} } = {}) {
  if (!item) return true; // niets om op te filteren → default-on
  /** @type {[string, string | undefined][]} */
  const axes = [['module', item.module], ['event_type', item.eventType], ['member', item.member]];
  for (const [axis, value] of axes) {
    if (value == null) continue; // deze as niet van toepassing op dit item
    if (axisDisabled(householdDisabled, axis, value)) return false; // huishouden wint
    if (axisDisabled(userDisabled, axis, value)) return false;
  }
  return true;
}
