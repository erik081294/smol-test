// @ts-check
// Pure onAction-bridge van de assistent (AI-8; het AI-7-voorschot uit de
// guidelines §9): alles wat de client met een HITL-voorstel mag, gereduceerd
// tot een whitelist + pure vertalingen. De React-laag (useAssistant /
// AssistantMessageView) blijft dun; deze module is unit-getest en
// mutatie-bewaakt.
//
// De client stuurt uitsluitend { id, decision, selected } — nooit args: de
// server voert de dáár opgeslagen args uit (assistant/actions.js is de
// server-tegenhanger; de kleine status-afleiding hieronder spiegelt die bewust
// i.p.v. edge-code in de app-bundle te trekken).

// Besluiten die de app mag insturen. Al het andere bouwt geen request.
export const ACTION_DECISIONS = ['confirm', 'reject', 'undo'];

// Moet gelijk lopen met ACTION_TTL_SECONDS op de server (assistant/actions.js).
export const ACTION_TTL_SECONDS = 3600;

/**
 * Request-body voor een besluit op een voorstel. Ongeldig besluit of ontbrekend
 * id → null (de aanroeper stuurt dan niets — een kapotte knop mag nooit een
 * half request produceren).
 * @param {string} actionId
 * @param {string} decision
 * @param {number[]} [selected] aangevinkte item-indexen; weglaten = alles
 * @returns {{ action: { id: string, decision: string, selected?: number[] } } | null}
 */
export function buildResolveBody(actionId, decision, selected) {
  if (typeof actionId !== 'string' || actionId.length === 0) return null;
  if (!ACTION_DECISIONS.includes(decision)) return null;
  return {
    action: Array.isArray(selected)
      ? { id: actionId, decision, selected }
      : { id: actionId, decision },
  };
}

/**
 * Weergavestatus van een role='action'-rij: de opgeslagen status, behalve dat
 * een verlopen 'pending' als 'expired' toont (TTL vanaf created_at).
 * @param {{ content?: { status?: string }, created_at?: string }} row
 * @param {string} nowIso
 */
export function actionStatusFromRow(row, nowIso) {
  const status = typeof row?.content?.status === 'string' ? row.content.status : 'pending';
  if (status !== 'pending') return status;
  const created = Date.parse(row?.created_at ?? '');
  const now = Date.parse(nowIso);
  if (Number.isNaN(created) || Number.isNaN(now)) return 'expired'; // onleesbaar = niet bevestigbaar
  return now - created > ACTION_TTL_SECONDS * 1000 ? 'expired' : 'pending';
}

/**
 * role='action'-rijen → { actionId: weergavestatus } voor het stempelen van
 * geladen gesprekken.
 * @param {Array<{ id?: string, content?: object, created_at?: string }>} [rows]
 * @param {string} [nowIso]
 * @returns {Record<string, string>}
 */
export function actionStatusMap(rows = [], nowIso = '') {
  const map = /** @type {Record<string, string>} */ ({});
  for (const row of rows) {
    if (typeof row?.id === 'string' && row.id.length > 0) map[row.id] = actionStatusFromRow(row, nowIso);
  }
  return map;
}

/**
 * Stempel de status van bevestigingskaarten in een (genormaliseerde) tree.
 * Retourneert een NIEUWE tree (React-state blijft immutable); nodes zonder
 * bekende actionId blijven ongemoeid.
 * @param {object[]} [tree]
 * @param {Record<string, string>} [statusById]
 * @returns {object[]}
 */
export function stampActionStatus(tree = [], statusById = {}) {
  return tree.map((node) =>
    node?.type === 'confirm_action' && typeof statusById[node.actionId] === 'string'
      ? { ...node, status: statusById[node.actionId] }
      : node
  );
}

/**
 * Checkbox-toggle voor de multi-edit-kaart: id erin of eruit, gesorteerd en
 * zonder duplicaten — de selectie is daarmee deterministisch vergelijkbaar.
 * @param {number[]|undefined} selected
 * @param {number} id
 * @returns {number[]}
 */
export function toggleSelection(selected, id) {
  const set = new Set(selected ?? []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set].sort((a, b) => a - b);
}
