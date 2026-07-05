// @ts-check
// Pure HITL-kern van de assistent (AI-8, plan 23 §4 / plan 24 ronde G): de
// statusmachine van een write-voorstel. De agent-loop voert een write-tool nooit
// uit — de harness (index.ts) onderschept de call, laat de tool een puur voorstel
// bouwen (propose), slaat dat op als role='action'-bericht en de gebruiker beslist.
//
// Industry-les (OpenAI needsApproval / Vercel AI SDK / LangGraph interrupt /
// Claude Code permissions, onderzoek 2026-07-05): de tool-call ís het voorstel;
// bevestiging is beleid óver tool-calls in de harness, geen aparte execute-tool
// die het model kan hallucineren en geen confirmed-flag die het model zelf op
// true kan zetten. De client bevestigt uitsluitend een voorstel-ID; uitgevoerd
// worden alleen de hier OPGESLAGEN args — nooit args uit het bevestigings-request.
//
// Alles hier is puur (geen Deno/Supabase) → node:test + mutatie-ratchet.

// Een voorstel is 1 uur geldig (plan 23 §4: kaart dimt met "verlopen").
export const ACTION_TTL_SECONDS = 3600;

// Besluiten die de client mag insturen — whitelist, al het andere is een 400.
export const ACTION_DECISIONS = ['confirm', 'reject', 'undo'];

// Statussen van een action-rij (content.status). 'executing' is het claim-slot
// tegen dubbel uitvoeren (dubbeltik/race): de conditionele update van pending →
// executing wint maar één keer.
export const ACTION_STATUSES = ['pending', 'executing', 'done', 'failed', 'rejected', 'undone'];

/**
 * Bouw de content-jsonb van een role='action'-bericht uit een tool-voorstel.
 * `items` (weergaveteksten) en `args.items` lopen 1-op-1 — die uitlijning is
 * het contract voor per-item aan/uitvinken op de bevestigingskaart.
 * @param {{ name: string, moduleKey: string }} tool
 * @param {{ summary: string, items: string[], args: object }} proposal
 */
export function buildActionContent(tool, proposal) {
  return {
    v: 1,
    kind: 'proposal',
    tool: tool.name,
    moduleKey: tool.moduleKey,
    summary: proposal.summary,
    items: proposal.items,
    args: proposal.args,
    status: 'pending',
  };
}

/**
 * De confirm_action-node voor in de render-tree (server-deterministisch, plan 23 §5).
 * @param {string} actionId
 * @param {{ summary: string, items?: string[] }} content
 */
export function confirmActionNode(actionId, content) {
  const items = Array.isArray(content.items) ? content.items : [];
  return {
    type: 'confirm_action',
    actionId,
    summary: content.summary,
    items: items.map((text, i) => ({ id: i, text })),
  };
}

/**
 * Is dit voorstel verlopen? Puur op ISO-strings (lexicografisch vergelijkbaar
 * na Date-normalisatie); alleen een 'pending' voorstel kan verlopen.
 * @param {{ content?: { status?: string }, created_at?: string }} row
 * @param {string} nowIso
 */
export function isExpired(row, nowIso) {
  // Geen status = als pending behandelen: een rij zonder statusveld mag nooit
  // ruimer bevestigbaar zijn dan een normale pending-rij.
  if ((row?.content?.status ?? 'pending') !== 'pending') return false;
  const created = Date.parse(row?.created_at ?? '');
  const now = Date.parse(nowIso);
  if (Number.isNaN(created) || Number.isNaN(now)) return true; // onleesbaar = niet uitvoeren
  return now - created > ACTION_TTL_SECONDS * 1000;
}

/**
 * Effectieve toestand van een action-rij voor weergave: de opgeslagen status,
 * behalve dat een verlopen 'pending' als 'expired' toont.
 * @param {{ content?: { status?: string }, created_at?: string }} row
 * @param {string} nowIso
 * @returns {string}
 */
export function actionState(row, nowIso) {
  if (isExpired(row, nowIso)) return 'expired';
  const status = row?.content?.status;
  return typeof status === 'string' && ACTION_STATUSES.includes(status) ? status : 'pending';
}

/**
 * Mag dit besluit nu op deze rij? Retourneert een gebruikersleesbare fout —
 * de schil geeft 'm 1-op-1 terug (er lekt geen intern detail).
 * @param {{ content?: { status?: string, kind?: string, tool?: string }, created_at?: string }} row
 * @param {string} decision
 * @param {string} nowIso
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function canResolve(row, decision, nowIso) {
  if (!ACTION_DECISIONS.includes(decision)) return { ok: false, error: 'Onbekend besluit.' };
  if (row?.content?.kind !== 'proposal' || typeof row?.content?.tool !== 'string') {
    return { ok: false, error: 'Dit voorstel is niet gevonden.' };
  }
  const state = actionState(row, nowIso);
  if (decision === 'undo') {
    return state === 'done'
      ? { ok: true }
      : { ok: false, error: 'Er is niets om ongedaan te maken.' };
  }
  if (state === 'expired') return { ok: false, error: 'Dit voorstel is verlopen — vraag het gerust opnieuw.' };
  if (state !== 'pending') return { ok: false, error: 'Dit voorstel is al verwerkt.' };
  return { ok: true };
}

/**
 * Filter de opgeslagen args op de aangevinkte items (indexen in content.items).
 * Geen selectie meegegeven → alles. Lege of volledig ongeldige selectie → fout:
 * "niets aangevinkt maar toch Doen" is een client-bug die je wilt zien.
 * @param {{ items: object[] }} args opgeslagen (genormaliseerde) tool-args
 * @param {number[]|undefined} selected indexen van aangevinkte items
 * @returns {{ ok: true, args: { items: object[] } } | { ok: false, error: string }}
 */
export function selectItems(args, selected) {
  const all = Array.isArray(args?.items) ? args.items : [];
  if (all.length === 0) return { ok: false, error: 'Dit voorstel bevat geen items.' };
  if (selected === undefined || selected === null) return { ok: true, args: { ...args, items: all } };
  if (!Array.isArray(selected)) return { ok: false, error: 'Ongeldige selectie.' };
  const picked = [...new Set(selected)]
    .filter((i) => Number.isInteger(i) && i >= 0 && i < all.length)
    .sort((a, b) => a - b)
    .map((i) => all[i]);
  if (picked.length === 0) return { ok: false, error: 'Vink minstens één item aan.' };
  return { ok: true, args: { ...args, items: picked } };
}

// Tabellen waaruit een undo mag verwijderen — hard begrensd tot wat de
// write-tools zelf invoegen. Een action-rij met een andere tabel in
// result.inserted (data-corruptie, oude versie) wordt geweigerd.
export const UNDO_TABLE_WHITELIST = ['tasks', 'groceries', 'meal_plan_entries'];

/**
 * Groepeer result.inserted per tabel voor de undo-verwijdering; valideert elke
 * regel tegen de whitelist. { tasks: [id, id], groceries: [id] }.
 * @param {Array<{table?: string, id?: string}>} [inserted]
 * @returns {{ ok: true, byTable: Record<string, string[]> } | { ok: false, error: string }}
 */
export function undoPlan(inserted = []) {
  if (!Array.isArray(inserted) || inserted.length === 0) {
    return { ok: false, error: 'Er is niets om ongedaan te maken.' };
  }
  const byTable = /** @type {Record<string, string[]>} */ ({});
  for (const row of inserted) {
    if (!row || !UNDO_TABLE_WHITELIST.includes(row.table ?? '') || typeof row.id !== 'string' || row.id.length === 0) {
      return { ok: false, error: 'Dit voorstel kan niet ongedaan worden gemaakt.' };
    }
    (byTable[/** @type {string} */ (row.table)] ??= []).push(row.id);
  }
  return { ok: true, byTable };
}

/**
 * Nieuwe content na een besluit: status + eventuele result-velden erbij,
 * de rest (tool, args, summary, items) blijft onaangeroerd staan — de rij is
 * het audit-spoor van wat er is voorgesteld én wat ermee gebeurd is.
 * @param {object} content
 * @param {string} status
 * @param {object} [extra] bv. { result: { summary, inserted } } of { error }
 */
export function contentWithStatus(content, status, extra = {}) {
  return { ...content, status, ...extra };
}
