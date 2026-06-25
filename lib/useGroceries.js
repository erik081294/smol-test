import { useCollection } from './useCollection';
import { normalize } from './productMatch';
import { mergeQuantity, parseQuantity, formatQuantity } from './quantity';

// Boodschappen-module bovenop useCollection. De gedeelde lijst is bewust
// huishouden-breed (visibility blijft de default 'household'); het datamodel
// ondersteunt subgroepen wél, dus een latere "privé-lijst" kan zonder migratie.
export function useGroceries() {
  const c = useCollection('groceries', {
    label: 'boodschappen',
    creatorColumn: 'added_by',
    order: [
      { column: 'checked', ascending: true },
      { column: 'created_at', ascending: false },
    ],
  });

  const toggle = (item) => c.update(item.id, { checked: !item.checked });

  // Vrije-tekst aantal op een lijstrij bijstellen ("2 pak", of null = enkelvoud).
  // De inline +/−-stepper op de open rij werkt hierop (lib/quantity.js).
  const setQuantity = (item, quantity) => c.update(item.id, { quantity: quantity ?? null });

  // Het aantal van een product op de lijst ZETTEN op een absoluut getal (de gekoppelde
  // catalogus/lijst-stepper). count<=0 = van de lijst halen; >0 = create of update. Koppelt
  // aan een product zodat de recency-trigger blijft vullen. Eenheid: bestaande wint, anders
  // de meegegeven default. count 1 toont geen aantal (formatQuantity → null), net als elders.
  const setCount = (name, count, { productId = null, unit = '' } = {}) => {
    const norm = normalize(name);
    const existing = c.items.find((i) => !i.checked && normalize(i.name) === norm);
    const n = Math.max(0, Math.trunc(Number(count) || 0));
    if (n <= 0) return existing ? c.remove(existing.id) : Promise.resolve();
    const u = existing ? (parseQuantity(existing.quantity).unit || unit) : unit;
    const quantity = formatQuantity(n, u);
    if (existing) {
      const patch = { quantity: quantity ?? null };
      if (!existing.product_id && productId) patch.product_id = productId;
      return c.update(existing.id, patch);
    }
    return c.create({
      name,
      ...(productId ? { product_id: productId } : {}),
      ...(quantity ? { quantity } : {}),
    });
  };

  return {
    items: c.items,
    loading: c.loading,
    reload: c.reload,
    // Optioneel gekoppeld aan een catalogusproduct: `productId` = per-huishouden
    // product (BOO-5, voedt de prijsdata); `catalogProductId` = globaal product
    // (legacy). `quantity` is vrije tekst ("2 pak") voor "meerdere halen". Alle optioneel.
    //
    // Staat hetzelfde product al (open) op de lijst? Dan voegen we samen: het aantal
    // wordt opgeteld i.p.v. een dubbele regel te maken (UX — "dubbele melk"). Afgevinkte
    // regels tellen niet mee (die zijn "klaar"). Eén ronde-trip, optimistisch via update.
    add: (name, productId = null, catalogProductId = null, quantity = null) => {
      const norm = normalize(name);
      const existing = c.items.find((i) => !i.checked && normalize(i.name) === norm);
      if (existing) {
        const patch = { quantity: mergeQuantity(existing.quantity, quantity) };
        if (!existing.product_id && productId) patch.product_id = productId;
        return c.update(existing.id, patch);
      }
      return c.create({
        name,
        ...(productId ? { product_id: productId } : {}),
        ...(catalogProductId ? { catalog_product_id: catalogProductId } : {}),
        ...(quantity ? { quantity } : {}),
      });
    },
    toggle,
    setQuantity,
    setCount,
    remove: c.remove,
    // Bulk-delete (optimistisch). Het scherm stelt de echte wis uit achter een
    // "ongedaan maken"-toast; daarom geven we removeMany rechtstreeks door.
    removeMany: c.removeMany,
  };
}
