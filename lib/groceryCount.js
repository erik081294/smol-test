// Pure helper voor de gekoppelde catalogus/lijst-stepper: hoeveel staat er van een
// product (open) op de boodschappenlijst? Op genormaliseerde naam; afgevinkte regels
// tellen niet mee (die zijn "klaar"). Niet op de lijst → 0. Géén React/IO.
import { normalize } from './productMatch';
import { parseQuantity } from './quantity';

export function countOf(items, name) {
  const norm = normalize(name);
  if (!norm) return 0;
  const it = (items ?? []).find((i) => !i.checked && normalize(i.name) === norm);
  return it ? parseQuantity(it.quantity).count : 0;
}
