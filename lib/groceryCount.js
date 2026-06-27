// @ts-check
// Pure helper voor de gekoppelde catalogus/lijst-stepper: hoeveel staat er van een
// product (open) op de boodschappenlijst? Op genormaliseerde naam; afgevinkte regels
// tellen niet mee (die zijn "klaar"). Niet op de lijst → 0. Géén React/IO.
import { normalize } from './productMatch';
import { parseQuantity } from './quantity';

export function countOf(items, name) {
  const norm = normalize(name);
  if (!norm) return 0;
  // Tel álle open regels die op dezelfde genormaliseerde naam matchen op. Hetzelfde product
  // kan via meerdere bronnen op de lijst staan (handmatig + via de catalogus); .find() zou
  // dan alleen de eerste tellen en de stepper-badge zou ondertellen.
  return (items ?? [])
    .filter((i) => !i.checked && normalize(i.name) === norm)
    .reduce((sum, i) => sum + parseQuantity(i.quantity).count, 0);
}
