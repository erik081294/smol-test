import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { mutate, run } from './db';
import { useCollection } from './useCollection';
import { useHousehold } from './household';
import { normalize, bestMatch, suggestions } from './productMatch';
import { frequencyEstimate } from './buyFrequency';

// Productcatalogus per huishouden (BOO-5) bovenop de generieke useCollection-hook.
// De catalogus is household-breed referentiedata (is_member-RLS, géén visibility),
// dus het standaard collectie-contract volstaat. Het enige extra werk is de
// genormaliseerde `search`-kolom bij het aanmaken (de matching-bron) en twee
// helpers die de pure matching-kern (lib/productMatch.js) op de geladen catalogus
// toepassen.
export function useProducts() {
  const c = useCollection('products', {
    label: 'producten',
    order: [{ column: 'name', ascending: true }],
  });

  // Maak een product en geef de nieuwe rij terug (incl. id), zodat een bon-regel er
  // meteen aan gekoppeld kan worden. `search` is de genormaliseerde naam zodat fuzzy
  // matching op opgeslagen waarden werkt. De realtime-subscription van useCollection
  // ververst de lijst vanzelf.
  const addProduct = ({ name, category, defaultUnit, emoji }) =>
    mutate(
      supabase.from('products').insert({
        household_id: c.activeId,
        created_by: c.user.id,
        name: name.trim(),
        search: normalize(name),
        ...(category ? { category } : {}),
        ...(defaultUnit ? { default_unit: defaultUnit } : {}),
        ...(emoji ? { emoji } : {}),
      }).select().single(),
      { context: 'product toevoegen' }
    );

  // Find-or-create op genormaliseerde naam: geeft het bestaande huishoud-product terug,
  // of maakt het zo nodig aan. Zo koppelt élke boodschap (getypt of uit de catalogus) aan
  // een product, en houdt de DB-trigger `times_added`/`last_added_at` bij — de motor onder
  // "Eerder gekozen". Lege naam → null (niets te koppelen).
  const ensureProduct = async ({ name, category, defaultUnit, emoji } = {}) => {
    const norm = normalize(name || '');
    if (!norm) return null;
    const existing = c.items.find((p) => (p.search || normalize(p.name || '')) === norm);
    if (existing) return existing;
    return addProduct({ name, category, defaultUnit, emoji });
  };

  // Bewerk een bestaand huishoud-product (BOO-13). Geldt huishouden-breed: het schrijft
  // naar de gedeelde `products`-rij (is_member-RLS), dus de wijziging is voor iedereen
  // zichtbaar. `name` herberekent meteen de genormaliseerde `search` (de matching-bron).
  // Velden die je niet meegeeft blijven ongemoeid; een leeg veld (category/unit/emoji)
  // wordt op null gezet → terugval op de schap-default/categorie-emoji.
  const updateProduct = (id, { name, category, defaultUnit, emoji } = {}) => {
    const patch = {};
    if (name != null && name.trim()) { patch.name = name.trim(); patch.search = normalize(name); }
    if (category !== undefined) patch.category = category || null;
    if (defaultUnit !== undefined) patch.default_unit = defaultUnit || null;
    if (emoji !== undefined) patch.emoji = emoji || null;
    return c.update(id, patch);
  };

  // Beste catalogus-match voor een ruwe (bon)regel-naam, of null onder de drempel.
  const matchFor = (name, threshold = 0.6) => bestMatch(name, c.items, threshold);

  // Top-N "bedoelde je…?"-kandidaten voor een autocomplete/suggestie-UI.
  const suggestFor = (name, n = 3) => suggestions(name, c.items, n);

  // Verberg/toon een product in het "Vaste boodschappen"-overzicht (huishouden-breed).
  const setHidden = (id, hidden) =>
    mutate(supabase.from('products').update({ hidden }).eq('id', id),
      { context: hidden ? 'product verbergen' : 'product tonen' });

  return {
    products: c.items,
    loading: c.loading,
    reload: c.reload,
    addProduct,
    ensureProduct,
    updateProduct,
    matchFor,
    suggestFor,
    setHidden,
    user: c.user,
  };
}

// Aankoopfrequentie per product (BOO-8): één query over de bonregels van het
// huishouden (join purchases voor de datum), gegroepeerd per product en omgezet
// naar een frequentie-schatting via de pure heuristiek. RLS scoopt mee. Producten
// met < 2 aankopen vallen weg (geen betrouwbare schatting).
//  -> { byProduct: { [productId]: estimate }, reload }
export function useProductFrequencies() {
  const { activeId } = useHousehold();
  const [byProduct, setByProduct] = useState({});

  const load = useCallback(async () => {
    if (!activeId) { setByProduct({}); return; }
    // Window: alleen aankopen van de laatste 12 maanden. Een koopfrequentie schat je op
    // recent gedrag; ál het bon-verleden ophalen groeit ongebreideld met de historie.
    // `!inner` + gte filtert de parent-rijen (niet alleen de embedded purchase) op de datum.
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const rows = await run(
      supabase
        .from('purchase_items')
        .select('product_id, purchase:purchases!inner(purchased_on)')
        .eq('household_id', activeId)
        .not('product_id', 'is', null)
        .gte('purchase.purchased_on', cutoffIso),
      { fallback: [], context: 'aankoopfrequentie laden' }
    );
    const datesByProduct = {};
    for (const r of rows ?? []) {
      const on = r.purchase?.purchased_on;
      if (!r.product_id || !on) continue;
      (datesByProduct[r.product_id] ??= []).push(on);
    }
    const out = {};
    for (const [pid, dates] of Object.entries(datesByProduct)) {
      const est = frequencyEstimate(dates);
      if (est) out[pid] = est;
    }
    setByProduct(out);
  }, [activeId]);

  useEffect(() => { load(); }, [load]);
  return { byProduct, reload: load };
}
