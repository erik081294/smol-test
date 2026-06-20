import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { run } from './db';
import { normalize } from './productMatch';

// Lees-hooks voor de GLOBALE productcatalogus (Open Food Facts, NL) uit 0014.
// Anders dan useCollection is dit niet huishouden-gescopet: het is gedeelde
// referentiedata, alleen-lezen. Zoeken loopt via de search_catalog-RPC.

const PAGE = 30;

// De curated categorie-"schappen", op sorteervolgorde. Statisch genoeg om één
// keer te laden.
export function useCatalogCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await run(
        supabase.from('catalog_categories').select('*').order('sort', { ascending: true }),
        { fallback: [], context: 'catalogus-categorieën laden' }
      );
      if (alive) { setCategories(data ?? []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);
  return { categories, loading };
}

// Zoeken/bladeren in de catalogus, gestuurd door `query` + `category`.
// Debounced (typen voelt rustig), gepagineerd via loadMore (oneindig scrollen).
// Lege query + gekozen categorie = blader-modus (alfabetisch binnen het schap).
export function useCatalogSearch({ query, category }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const reqId = useRef(0);

  // We normaliseren de zoekterm met dezelfde regels als de opgeslagen `search`-
  // kolom (lib/productMatch.normalize), zodat "Halfvolle Melk 1L" matcht.
  const q = normalize(query || '');
  const cat = category || null;
  // We laden bewust pas zodra er iets gekozen is: een zoekterm óf een categorie.
  // Zonder dat blijft het scherm leeg (geen ongevraagde lijst, geen onnodige call).
  const active = q.length > 0 || cat != null;

  const fetchPage = useCallback(async (offset) => {
    const { data, error } = await supabase.rpc('search_catalog', {
      p_query: q, p_category: cat, p_limit: PAGE, p_offset: offset,
    });
    if (error) { console.warn(`[Huishoek] Laadfout (catalogus zoeken): ${error.message}`); return []; }
    return data ?? [];
  }, [q, cat]);

  // (Her)laad vanaf nul bij elke wijziging van query/categorie. Een teller merkt
  // verouderde antwoorden zodat een trage respons een nieuwere niet overschrijft.
  useEffect(() => {
    const id = ++reqId.current;
    if (!active) { setItems([]); setHasMore(false); setLoading(false); return undefined; }
    setLoading(true);
    const handle = setTimeout(async () => {
      const rows = await fetchPage(0);
      if (id !== reqId.current) return;
      setItems(rows);
      setHasMore(rows.length === PAGE);
      setLoading(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [fetchPage, active]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    const rows = await fetchPage(items.length);
    if (id === reqId.current) {
      setItems((cur) => [...cur, ...rows]);
      setHasMore(rows.length === PAGE);
    }
    setLoadingMore(false);
  }, [fetchPage, items.length, hasMore, loading, loadingMore]);

  return { items, loading, loadingMore, hasMore, loadMore, active };
}
