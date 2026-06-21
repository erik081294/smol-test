import { supabase } from './supabase';
import { mutate } from './db';
import { useCollection } from './useCollection';
import { normalize, bestMatch, suggestions } from './productMatch';

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
  const addProduct = ({ name, category, defaultUnit }) =>
    mutate(
      supabase.from('products').insert({
        household_id: c.activeId,
        created_by: c.user.id,
        name: name.trim(),
        search: normalize(name),
        ...(category ? { category } : {}),
        ...(defaultUnit ? { default_unit: defaultUnit } : {}),
      }).select().single(),
      { context: 'product toevoegen' }
    );

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
    matchFor,
    suggestFor,
    setHidden,
    user: c.user,
  };
}
