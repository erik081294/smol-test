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
// Bewust ≤6 node-types (plan 23, spijt-check 8): text, card, list, keyvalue,
// confirm_action, link. Uitbreiden = expliciete afweging, geen gewoonte.

export const CATALOG_TYPES = ['text', 'card', 'list', 'keyvalue', 'confirm_action', 'link'];

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
    case 'confirm_action':
      // De bevestigingskaart (HITL): zonder id of mensleesbare samenvatting is er
      // niets veiligs te bevestigen → droppen, nooit een lege ja/nee-kaart tonen.
      if (!isNonEmptyString(node.actionId) || !isNonEmptyString(node.summary)) return null;
      return { type: 'confirm_action', actionId: node.actionId, summary: node.summary };
    case 'link':
      // Alleen interne routes; model-/tool-output mag de app nooit naar buiten sturen.
      if (!isNonEmptyString(node.label) || !isNonEmptyString(node.route)) return null;
      if (!node.route.startsWith('/')) return null;
      return { type: 'link', label: node.label, route: node.route };
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
  }
  return parts.join('\n');
}
