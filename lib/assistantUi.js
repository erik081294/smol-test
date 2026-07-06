// @ts-check
// Pure catalog-validator voor de Huishoek Assistent (AI-1, plan 23 §5-gen-UI).
//
// De assistent-server stuurt naast tekst een declaratieve component-tree (A2UI-
// geïnspireerd, maar zonder externe dependency): een array van nodes uit een VASTE
// whitelist. Deze module is de poortwachter aan de app-kant — alles wat de renderer
// (lib/AssistantMessageView.js) tekent is eerst hierdoorheen genormaliseerd:
//   - onbekende node-types degraderen naar tekst (nooit crashen op nieuwe server-output);
//   - ontbrekende/verkeerd getypeerde velden krijgen veilige defaults of de node vervalt;
//   - links mogen alleen naar interne routes (beginnend met '/') — geen externe URL's
//     uit model-/tool-output de router in.
//
// Bewust een kleine, vaste set node-types (plan 23, spijt-check 8): text, card,
// list, keyvalue, confirm_action, link + recipe (AI-12: de recept-kaart waarop de
// gebruiker over een AI-voorstel beslist) + chart/schedule/choice (AI-16 ronde 1,
// plan 26: interactieve gen-UI — grafiek, rooster, beslis-kaart). Uitbreiden =
// expliciete afweging (§9, max +3 per ronde), geen gewoonte.

export const CATALOG_TYPES = ['text', 'card', 'list', 'keyvalue', 'confirm_action', 'link', 'recipe', 'chart', 'schedule', 'choice'];

// Grenzen van de interactieve nodes (AI-16): een grafiek met 40 staven of een
// beslis-kaart met 20 knoppen is geen UI meer — de server hoort dit al te
// begrenzen, de poortwachter kapt af (nooit vertrouwen op de afzender).
export const MAX_CHART_POINTS = 12;
export const MAX_CHOICE_OPTIONS = 6;
export const MAX_SCHEDULE_DAYS = 14;

// Weergavestaten van een bevestigingskaart (HITL, AI-8). 'pending' is de enige
// waarin geknopt kan worden; al het andere rendert als afgehandelde kaart.
// Spiegelt de server-statusmachine (assistant/actions.js) + 'expired' (afgeleid).
export const ACTION_UI_STATES = ['pending', 'executing', 'done', 'failed', 'rejected', 'undone', 'expired'];

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// Houd alleen niet-lege strings over; alles wat geen string is vervalt (geen
// impliciete String(...)-casts van objecten als "[object Object]").
const cleanStrings = (v) => (Array.isArray(v) ? v.filter(isNonEmptyString) : []);

/**
 * Normaliseer één node uit server-output naar een veilige render-node.
 * Onbekend type met bruikbare tekst → text-node; anders null (droppen).
 * @param {any} node
 * @returns {object|null}
 */
export function normalizeNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  switch (node.type) {
    case 'text':
      return isNonEmptyString(node.text) ? { type: 'text', text: node.text } : null;
    case 'card': {
      const lines = cleanStrings(node.lines);
      const title = isNonEmptyString(node.title) ? node.title : null;
      if (!title && lines.length === 0) return null;
      return {
        type: 'card',
        title,
        emoji: isNonEmptyString(node.emoji) ? node.emoji : null,
        lines,
      };
    }
    case 'list': {
      const items = Array.isArray(node.items)
        ? node.items
            .map((it) =>
              isNonEmptyString(it?.text)
                ? { text: it.text, emoji: isNonEmptyString(it.emoji) ? it.emoji : null }
                : null
            )
            .filter(Boolean)
        : [];
      if (items.length === 0) return null;
      return { type: 'list', title: isNonEmptyString(node.title) ? node.title : null, items };
    }
    case 'keyvalue': {
      const pairs = Array.isArray(node.pairs)
        ? node.pairs
            .map((p) => (isNonEmptyString(p?.k) && isNonEmptyString(p?.v) ? { k: p.k, v: p.v } : null))
            .filter(Boolean)
        : [];
      if (pairs.length === 0) return null;
      return { type: 'keyvalue', title: isNonEmptyString(node.title) ? node.title : null, pairs };
    }
    case 'confirm_action': {
      // De bevestigingskaart (HITL, AI-8): zonder id of mensleesbare samenvatting
      // is er niets veiligs te bevestigen → droppen, nooit een lege ja/nee-kaart.
      if (!isNonEmptyString(node.actionId) || !isNonEmptyString(node.summary)) return null;
      // Multi-edit: per-item aan/uitvinkbaar. Een item zonder geldige integer-id
      // of tekst vervalt — de id's zijn de indexen in de OPGESLAGEN server-args,
      // dus een verzonnen id mag nooit doorsijpelen naar het bevestigen.
      const items = Array.isArray(node.items)
        ? node.items
            .map((it) =>
              Number.isInteger(it?.id) && it.id >= 0 && isNonEmptyString(it?.text)
                ? { id: it.id, text: it.text }
                : null
            )
            .filter(Boolean)
        : [];
      const status = ACTION_UI_STATES.includes(node.status) ? node.status : 'pending';
      return { type: 'confirm_action', actionId: node.actionId, summary: node.summary, items, status };
    }
    case 'link':
      // Alleen interne routes; model-/tool-output mag de app nooit naar buiten sturen.
      if (!isNonEmptyString(node.label) || !isNonEmptyString(node.route)) return null;
      if (!node.route.startsWith('/')) return null;
      return { type: 'link', label: node.label, route: node.route };
    case 'recipe': {
      // De recept-kaart (AI-12): titel, porties, ingrediëntregels en genummerde
      // bereidingsstappen — spiegel van renderRecipe in de maaltijden-skill-file.
      // Zonder titel én zonder ingrediënten is er geen recept te tonen → droppen.
      // AI-16: naast `text` reizen optioneel gestructureerde velden mee
      // (name/quantity/unit) — die voeden de porties-stepper met live
      // herrekening (lib/assistantGenUi.js). Ongeldig gestructureerd veld →
      // alleen dat veld vervalt, de tekstregel blijft (degradatie per veld).
      const title = isNonEmptyString(node.title) ? node.title : null;
      const ingredients = Array.isArray(node.ingredients)
        ? node.ingredients
            .map((it) => {
              if (!isNonEmptyString(it?.text)) return null;
              const name = isNonEmptyString(it.name) ? it.name : null;
              const quantity = typeof it.quantity === 'number' && Number.isFinite(it.quantity) && it.quantity > 0 ? it.quantity : null;
              const unit = isNonEmptyString(it.unit) ? it.unit : null;
              return name && quantity ? { text: it.text, name, quantity, unit } : { text: it.text };
            })
            .filter(Boolean)
        : [];
      const steps = cleanStrings(node.steps);
      if (!title && ingredients.length === 0) return null;
      return {
        type: 'recipe',
        title,
        servings: Number.isInteger(node.servings) && node.servings > 0 ? node.servings : null,
        ingredients,
        steps,
      };
    }
    case 'chart': {
      // Interactieve staafgrafiek (AI-16). Waarden moeten eindige getallen ≥ 0
      // zijn — een kapot punt vervalt (nooit een staaf op NaN tekenen). Zonder
      // geldige punten is er niets te tonen → droppen (de server stuurt dan
      // zijn tekst-fallback als aparte node, of oude clients pakken node.text).
      const points = Array.isArray(node.points)
        ? node.points
            .map((p) =>
              isNonEmptyString(p?.label) && typeof p?.value === 'number' && Number.isFinite(p.value) && p.value >= 0
                ? { label: p.label, value: p.value }
                : null
            )
            .filter(Boolean)
            .slice(0, MAX_CHART_POINTS)
        : [];
      if (points.length === 0) return null;
      return {
        type: 'chart',
        title: isNonEmptyString(node.title) ? node.title : null,
        unit: node.unit === 'euro' ? 'euro' : null,
        points,
      };
    }
    case 'schedule': {
      // Week-/dagrooster (AI-16): dag-rijen met entries; lege dagen zijn
      // informatie (gaten in het menu) en blijven staan. `today` komt van de
      // server (ctx.today) — de client rekent niet met klok/tijdzone.
      // Navigatie hoort hier bewust níét bij: details lopen via een losse
      // link-node ernaast (guidelines §8), geen tweede route-pad.
      const days = Array.isArray(node.days)
        ? node.days
            .map((d) => {
              if (!isNonEmptyString(d?.label)) return null;
              const entries = Array.isArray(d.entries)
                ? d.entries
                    .map((e) =>
                      isNonEmptyString(e?.text)
                        ? { text: e.text, emoji: isNonEmptyString(e.emoji) ? e.emoji : null }
                        : null
                    )
                    .filter(Boolean)
                : [];
              return { label: d.label, today: d.today === true, entries };
            })
            .filter(Boolean)
            .slice(0, MAX_SCHEDULE_DAYS)
        : [];
      if (days.length === 0) return null;
      return {
        type: 'schedule',
        title: isNonEmptyString(node.title) ? node.title : null,
        days,
      };
    }
    case 'choice': {
      // Beslis-kaart (AI-16, AskUserQuestion-patroon): opties mét context; een
      // tik stuurt `reply` als gewone gebruikersbeurt (geen args, geen tools —
      // de HITL-keten blijft onaangeroerd). Zonder prompt of zonder geldige
      // opties is er niets te beslissen → droppen.
      if (!isNonEmptyString(node.prompt)) return null;
      const options = Array.isArray(node.options)
        ? node.options
            .map((o) =>
              isNonEmptyString(o?.label) && isNonEmptyString(o?.reply)
                ? { label: o.label, description: isNonEmptyString(o.description) ? o.description : null, reply: o.reply }
                : null
            )
            .filter(Boolean)
            .slice(0, MAX_CHOICE_OPTIONS)
        : [];
      if (options.length === 0) return null;
      return { type: 'choice', prompt: node.prompt, options };
    }
    default:
      // Vergevingsgezinde degradatie: een nieuwer server-node-type met leesbare
      // inhoud wordt platte tekst i.p.v. een gat of een crash.
      if (isNonEmptyString(node.text)) return { type: 'text', text: node.text };
      if (isNonEmptyString(node.title)) return { type: 'text', text: node.title };
      return null;
  }
}

/**
 * Normaliseer een hele tree. Accepteert een array, één node, of rommel (→ []).
 * @param {any} [input]
 * @returns {object[]}
 */
export function normalizeTree(input = []) {
  const nodes = Array.isArray(input) ? input : [input];
  return nodes.map(normalizeNode).filter((n) => n !== null);
}

/**
 * Platte-tekst-terugval van een genormaliseerde tree — voor a11y-labels,
 * notificatie-previews en de laatste-bericht-regel in gesprekslijsten.
 * @param {object[]} [nodes] Reeds genormaliseerde nodes (uit normalizeTree).
 * @returns {string}
 */
export function treeToText(nodes = []) {
  const parts = [];
  for (const n of nodes) {
    if (n.type === 'text') parts.push(n.text);
    else if (n.type === 'card') parts.push([n.title, ...n.lines].filter(Boolean).join(' — '));
    else if (n.type === 'list') parts.push([n.title, n.items.map((i) => i.text).join(', ')].filter(Boolean).join(': '));
    else if (n.type === 'keyvalue') parts.push(n.pairs.map((p) => `${p.k}: ${p.v}`).join(', '));
    else if (n.type === 'confirm_action') parts.push(n.summary);
    else if (n.type === 'link') parts.push(n.label);
    else if (n.type === 'recipe') {
      parts.push([n.title, n.ingredients.map((i) => i.text).join(', ')].filter(Boolean).join(': '));
    } else if (n.type === 'chart') {
      // De tabelvorm van de grafiek (a11y-relief, plan 26): elk punt leesbaar.
      parts.push([n.title, n.points.map((p) => `${p.label} ${p.value}`).join(', ')].filter(Boolean).join(': '));
    } else if (n.type === 'schedule') {
      const rows = n.days.map((d) => `${d.label}: ${d.entries.length > 0 ? d.entries.map((e) => e.text).join(', ') : '—'}`);
      parts.push([n.title, rows.join('; ')].filter(Boolean).join(' — '));
    } else if (n.type === 'choice') {
      parts.push([n.prompt, n.options.map((o) => o.label).join(' / ')].filter(Boolean).join(' '));
    }
  }
  return parts.join('\n');
}

/**
 * ActionId's van nog te beslissen bevestigingskaarten in een (genormaliseerde,
 * gestempelde) tree — de "Akkoord met alles"-knop (AI-12) verschijnt pas bij ≥2.
 * Elke actie blijft server-side atomair (eigen execute/undo); de bundel is puur
 * presentatie: de client bevestigt ze één voor één via het bestaande endpoint.
 * @param {object[]} [nodes]
 * @returns {string[]}
 */
export function pendingActionIds(nodes = []) {
  return nodes
    .filter((n) => n?.type === 'confirm_action' && (n.status ?? 'pending') === 'pending' && isNonEmptyString(n.actionId))
    .map((n) => n.actionId);
}
