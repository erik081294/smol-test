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
// 'edit' (AI-10): de gebruiker bewerkt een pending voorstel — de enige route
// waarin de client wél args stuurt (een expliciete eigen bewerking; de server
// hervalideert via dezelfde pure propose() als bij model-args).
export const ACTION_DECISIONS = ['confirm', 'reject', 'undo', 'edit'];

// Moet gelijk lopen met ACTION_TTL_SECONDS op de server (assistant/actions.js).
export const ACTION_TTL_SECONDS = 3600;

/**
 * Request-body voor een besluit op een voorstel. Ongeldig besluit of ontbrekend
 * id → null (de aanroeper stuurt dan niets — een kapotte knop mag nooit een
 * half request produceren). Voor 'edit' zijn args verplicht.
 * @param {string} actionId
 * @param {string} decision
 * @param {number[]} [selected] aangevinkte item-indexen; weglaten = alles
 * @param {{ args?: object, memberNames?: Record<string,string> }} [extra] alleen voor 'edit'
 * @returns {{ action: object } | null}
 */
export function buildResolveBody(actionId, decision, selected, extra = {}) {
  if (typeof actionId !== 'string' || actionId.length === 0) return null;
  if (!ACTION_DECISIONS.includes(decision)) return null;
  if (decision === 'edit') {
    if (!extra.args || typeof extra.args !== 'object') return null;
    return {
      action: {
        id: actionId,
        decision,
        args: extra.args,
        ...(extra.memberNames ? { memberNames: extra.memberNames } : {}),
      },
    };
  }
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

// Bewerkbare velden per write-tool (AI-10, mens↔AI-overdracht). Dit is bewust
// presentatie-kennis aan de client-kant: welke velden een mens mag aanpassen en
// hoe de OPGESLAGEN (genormaliseerde) args heen-en-weer vertalen naar het
// invoerformaat dat propose() verwacht. tests/assistantActions.test.js bewaakt
// dat elke write-tool in de registry hier een entry heeft. Zodra AI-7 (A2UI)
// een server-gedreven formulierschema levert, verhuist dit naar de skill-files.
export const EDITABLE_FIELDS = {
  taken_toevoegen: [
    { key: 'title', labelKey: 'assistant.edit.title.task' },
    { key: 'due_date', labelKey: 'assistant.edit.date' },
    { key: 'assignee_name', labelKey: 'assistant.edit.assignee' },
  ],
  boodschappen_toevoegen: [
    { key: 'name', labelKey: 'assistant.edit.name' },
    { key: 'quantity', labelKey: 'assistant.edit.quantity' },
  ],
  boodschappen_afvinken: [
    { key: 'name', labelKey: 'assistant.edit.name' },
  ],
  maaltijden_plannen: [
    { key: 'date', labelKey: 'assistant.edit.date' },
    { key: 'title', labelKey: 'assistant.edit.title.meal' },
    { key: 'meal_type', labelKey: 'assistant.edit.mealType' },
    { key: 'servings', labelKey: 'assistant.edit.servings', int: true },
  ],
  maaltijden_recept_opslaan: [
    { key: 'title', labelKey: 'assistant.edit.title.recipe' },
    { key: 'servings', labelKey: 'assistant.edit.servings', int: true },
    { key: 'instructions', labelKey: 'assistant.edit.instructions' },
  ],
  // AI-19 fase B: de writes van de vijf nieuwe packs.
  planten_toevoegen: [
    { key: 'name', labelKey: 'assistant.edit.name' },
    { key: 'location', labelKey: 'assistant.edit.location' },
    { key: 'water_days', labelKey: 'assistant.edit.waterDays', int: true },
  ],
  huisdieren_logboek_toevoegen: [
    { key: 'pet_name', labelKey: 'assistant.edit.petName' },
    { key: 'note', labelKey: 'assistant.edit.note' },
    { key: 'weight_grams', labelKey: 'assistant.edit.weightGrams', int: true },
  ],
  voertuigen_onderhoud_loggen: [
    { key: 'vehicle_name', labelKey: 'assistant.edit.vehicleName' },
    { key: 'title', labelKey: 'assistant.edit.title.maintenance' },
    { key: 'performed_on', labelKey: 'assistant.edit.date' },
    { key: 'mileage', labelKey: 'assistant.edit.mileage', int: true },
  ],
  tijdlijn_plaatsen: [
    { key: 'body', labelKey: 'assistant.edit.body' },
  ],
  delen_reserveren: [
    { key: 'resource_name', labelKey: 'assistant.edit.resourceName' },
    { key: 'date', labelKey: 'assistant.edit.date' },
    { key: 'from', labelKey: 'assistant.edit.timeFrom' },
    { key: 'to', labelKey: 'assistant.edit.timeTo' },
    { key: 'note', labelKey: 'assistant.edit.note' },
  ],
};

// Velden die propose() wél accepteert maar niet plat bewerkbaar zijn (genest,
// of een technisch id): bij een edit reizen ze ongewijzigd mee vanaf het
// opgeslagen voorstel — anders zou bewaren ze stilletjes wissen (het recept
// verliest zijn ingrediënten, de maaltijd zijn receptkoppeling).
export const CARRY_FIELDS = {
  maaltijden_plannen: ['recipe_id'],
  maaltijden_recept_opslaan: ['ingredients'],
};

/**
 * Opgeslagen (genormaliseerde) args → bewerkbare items voor de edit-sheet.
 * Vertaalt per tool terug naar het propose()-invoerformaat: taken dragen
 * assigned_to (profiel-id) → assignee_name (weergavenaam); nulls worden ''.
 * @param {string} toolName
 * @param {{ items?: object[] }} [args]
 * @param {Record<string,string>} [memberNames] profiel-id → naam
 * @returns {object[]}
 */
export function toEditableItems(toolName, args = {}, memberNames = {}) {
  const items = Array.isArray(args.items) ? args.items : [];
  const fields = EDITABLE_FIELDS[toolName] ?? [];
  return items.map((it) => {
    const out = {};
    for (const f of fields) {
      if (f.key === 'assignee_name') out[f.key] = (it.assigned_to && memberNames[it.assigned_to]) || '';
      else out[f.key] = it[f.key] == null ? '' : String(it[f.key]);
    }
    return out;
  });
}

/**
 * Bewerkte items → args voor het edit-request (het propose()-invoerformaat).
 * Lege strings vallen weg (optionele velden), int-velden worden geparsed —
 * on-parsebaar → veld weglaten (propose valt dan op zijn default terug).
 * CARRY_FIELDS komen per index uit de OPGESLAGEN items mee (niet bewerkbaar,
 * wel verplicht voor propose — bv. de ingrediënten van een recept).
 * @param {string} toolName
 * @param {object[]} [editedItems]
 * @param {object[]} [originalItems] de opgeslagen (genormaliseerde) args.items
 * @returns {{ items: object[] }}
 */
export function fromEditableItems(toolName, editedItems = [], originalItems = []) {
  const fields = EDITABLE_FIELDS[toolName] ?? [];
  const carry = CARRY_FIELDS[toolName] ?? [];
  const items = editedItems.map((it, idx) => {
    const out = {};
    for (const key of carry) {
      const orig = originalItems[idx]?.[key];
      if (orig != null) out[key] = orig;
    }
    for (const f of fields) {
      const raw = typeof it[f.key] === 'string' ? it[f.key].trim() : it[f.key];
      if (raw === '' || raw == null) continue;
      if (f.int) {
        const n = Number.parseInt(String(raw), 10);
        if (Number.isInteger(n)) out[f.key] = n;
      } else {
        out[f.key] = String(raw);
      }
    }
    return out;
  });
  return { items };
}

/**
 * Patch de bevestigingskaart met een bewerkt voorstel (AI-10): nieuwe summary/
 * items uit het edit-antwoord van de server. Nieuwe tree (immutable); nodes met
 * een andere actionId blijven dezelfde referentie.
 * @param {object[]|undefined} tree
 * @param {string} actionId
 * @param {{ summary?: string, items?: Array<{id:number, text:string}> }} [patch]
 * @returns {object[]}
 */
export function patchActionNode(tree, actionId, patch = {}) {
  return (tree ?? []).map((node) =>
    node?.type === 'confirm_action' && node.actionId === actionId
      ? {
          ...node,
          ...(typeof patch.summary === 'string' && patch.summary ? { summary: patch.summary } : {}),
          ...(Array.isArray(patch.items) ? { items: patch.items } : {}),
        }
      : node
  );
}

/**
 * "Akkoord met alles" (AI-12): bevestig de openstaande voorstellen van één beurt
 * op volgorde, maar stóp bij het eerste dat faalt — de resterende voorstellen
 * blijven open en kan de gebruiker per kaart afhandelen (precies wat de knop
 * belooft; de vorige versie liep dóór alle voorstellen omdat resolveAction zijn
 * fouten intern opving). `resolveFn(id)` geeft true bij succes, false bij fout.
 * @param {string[]|undefined} ids
 * @param {(id: string) => Promise<boolean>} resolveFn
 * @returns {Promise<number>} het aantal bevestigde voorstellen
 */
export async function confirmSequence(ids, resolveFn) {
  let confirmed = 0;
  for (const id of ids ?? []) {
    const ok = await resolveFn(id);
    if (!ok) break;
    confirmed += 1;
  }
  return confirmed;
}

/**
 * Retry-opruiming (AI-13-poets): haal de gestrande beurt vooraan de (inverted)
 * berichtenlijst weg — de foutbubble én de gebruikersvraag die 'm veroorzaakte —
 * zodat een verse send() de vraag niet dúbbel toont met de oude foutbubble
 * ertussen. Staat er vooraan geen foutbubble, dan blijft de lijst (dezelfde
 * referentie) ongemoeid.
 * @param {Array<{ role?: string, error?: boolean }>} [messages] nieuwste eerst
 * @returns {Array<object>}
 */
export function dropStrandedTurn(messages = []) {
  if (messages[0]?.error !== true) return messages;
  // De foutbubble staat vooraan; de vraag die 'm opriep hoort er direct onder.
  return messages[1]?.role === 'user' ? messages.slice(2) : messages.slice(1);
}
