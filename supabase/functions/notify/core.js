// Pure, testbare kern voor de `notify` Edge Function (PLT-1, trap 2 — remote push).
//
// Géén Deno/Supabase/network: dit bepaalt alleen WELKE push naar WIE moet, gegeven
// een Database-Webhook-payload. De impure schil (`index.ts`) doet het ophalen van
// tokens, de idempotentie, het versturen en het opruimen. Dit bestand is plain
// ESM zodat het zowel door Deno (de functie) als door Node (`tests/notify.test.js`)
// geïmporteerd kan worden — dezelfde "pure kern + impure schil"-opzet als
// `lib/notifications.js` t.o.v. `lib/useNotifications.js`.

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_MAX_BATCH = 100; // Expo Push API: max 100 messages per request.

// Database-Webhook-payload → genormaliseerd event.
//   { type: 'INSERT'|'UPDATE'|'DELETE', table, record, old_record }
export function parseWebhookEvent(payload = {}) {
  return {
    type: payload.type ?? null,
    table: payload.table ?? null,
    record: payload.record ?? null,
    old_record: payload.old_record ?? null,
  };
}

// --- Handlers per tabel -----------------------------------------------------
// Een handler krijgt een genormaliseerd event en geeft 0..n Intents terug:
//   Intent = { recipientId, dedupKey, kind, title, body, data }
// Een nieuwe trigger toevoegen = een handler schrijven + in HANDLERS registreren.

// `tasks`: push bij een echte toewijzing aan iemand anders dan de maker.
function taskHandler({ type, record, old_record }) {
  if (!record) return [];
  const assignee = record.assigned_to;
  const creator = record.created_by;
  if (!assignee || assignee === creator) return [];
  // Bij UPDATE alleen sturen als de toewijzing daadwerkelijk wijzigde (geen
  // dubbele push bij ongerelateerde taak-edits).
  if (type === 'UPDATE' && old_record && old_record.assigned_to === assignee) return [];
  return [{
    recipientId: assignee,
    // Idempotentie-sleutel: stabiel per (taak, toegewezene). Een herhaalde
    // webhook-fire voor dezelfde toewijzing telt als dezelfde push.
    dedupKey: `task:${record.id}:assigned:${assignee}`,
    kind: 'task_assigned',
    title: 'Nieuwe taak voor jou',
    body: record.title || 'Je hebt een taak toegewezen gekregen',
    data: { kind: 'task_assigned', taskId: record.id },
  }];
}

// Registry: tabelnaam → handler. Uitbreidpunt voor volgende rondes, bijv.
// `expenses` (uitgave-toewijzing via expense_shares) of cron-gevoede maaltijd-/
// voorraadmeldingen. Voeg een handler toe en registreer 'm hier.
export const HANDLERS = {
  tasks: taskHandler,
};

// Router: payload → Intent[]. Leeg bij onbekende tabel of geen relevante match.
export function buildIntents(payload) {
  const event = parseWebhookEvent(payload);
  const handler = event.table ? HANDLERS[event.table] : null;
  if (!handler) return [];
  return handler(event) ?? [];
}

// Splits een array in stukken van max `size` (de Expo-batchlimiet).
export function chunk(arr = [], size = EXPO_MAX_BATCH) {
  if (size <= 0) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Bouw Expo-push-messages voor één intent over een set tokens. De volgorde blijft
// gelijk aan `tokens`, zodat de schil een foutticket 1-op-1 aan zijn token kan
// koppelen (voor het opruimen van dode tokens).
export function expoMessages(tokens = [], intent) {
  return tokens.map((to) => ({
    to,
    title: intent.title,
    body: intent.body,
    sound: 'default',
    data: intent.data ?? {},
  }));
}
