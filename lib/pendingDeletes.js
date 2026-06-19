// Module-globale verzameling van item-id's die "op het punt staan verwijderd te
// worden" — gevuld zolang hun undo-toast loopt. Lijst-hooks (useCollection,
// useExpenses) filteren deze id's eruit zodat een item meteen uit beeld verdwijnt,
// óók als de delete-actie vanuit een ander scherm komt (een editor-modal die
// daarna terugnavigeert). De échte server-verwijdering gebeurt pas als de toast
// verloopt; tikt de gebruiker op "Ongedaan maken", dan halen we de markering weg
// en is er niets onomkeerbaars gebeurd. Zo werkt "verwijderen met ongedaan maken"
// over scherm-grenzen heen, zónder de rij eerst te verwijderen en daarna weer aan
// te maken (wat nieuwe id's/created_at zou geven en historie zou wezen).
//
// Zelfde store-patroon als de taal-store in lib/i18n.js: een versieteller voedt
// useSyncExternalStore in de lijst-hooks, zodat die hertekenen bij elke mutatie.

const pending = new Set();
const listeners = new Set();
let version = 0;

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

// Markeer een id als "wordt verwijderd" (verbergt het in de lijsten). Idempotent:
// een al-gemarkeerd id verandert niets en stuurt geen overbodige notificatie.
export function markPending(id) {
  if (id == null || pending.has(id)) return;
  pending.add(id);
  emit();
}

// Haal de markering weg — bij "ongedaan maken" (item weer tonen) of na de echte
// delete (opruimen). Stuurt alleen een notificatie als er daadwerkelijk iets wijzigt.
export function unmarkPending(id) {
  if (pending.delete(id)) emit();
}

// Staat dit id op het punt verwijderd te worden?
export function isPending(id) {
  return pending.has(id);
}

// Versie-stempel voor useSyncExternalStore — verandert bij elke mutatie.
export function pendingVersion() {
  return version;
}

export function subscribePending(cb) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// Alleen voor tests: lege de store tussen cases.
export function _resetPending() {
  pending.clear();
  version = 0;
}
