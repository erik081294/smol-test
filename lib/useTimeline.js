import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, runResult, mutate } from './db';
import { visibilityPayload } from './visibility';
import { useRealtimeReload } from './useRealtimeReload';
import { getCached, setCached, cacheKey } from './dataCache';
import { uploadPhoto } from './photoStorage';
import { orderTimeline } from './timeline';
import { isPending, subscribePending, pendingVersion } from './pendingDeletes';

// Tijdlijn / prikbord (TML-1). De berichten met hun foto's: useCollection kan geen
// geneste select, dus we volgen het patroon van useExpenses — één query met embedded
// timeline_photos + een dubbele realtime-subscription die bij elke wijziging herlaadt.
// RLS scopet de payload (zichtbaarheidscontract). De volgorde (gepind eerst, dan
// nieuwste) komt uit de pure orderTimeline in lib/timeline.js.
const FEED_LIMIT = 100;
export const TIMELINE_BUCKET = 'timeline';

// Opslagpad: <household_id>/<post_id>/<key>.<ext> — eerste segment = household_id zodat
// de bucket-RLS (is_member op foldername[1]) erop scopet; uniek per foto.
function photoPath(householdId, postId, key, ext = 'jpg') {
  return `${householdId}/${postId}/${key}.${(ext || 'jpg').toLowerCase()}`;
}

export function useTimeline() {
  const { activeId, members } = useHousehold();
  const { user } = useAuth();

  // Stale-while-revalidate: seed uit de cache zodat een herbezochte Tijdlijn-tab geen
  // laad-skelet toont (PERF-2). We cachen de genormaliseerde, geordende rijen.
  const key = activeId ? cacheKey('timeline', activeId) : null;
  const initial = key ? getCached(key) : undefined;
  const [posts, setPosts] = useState(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);
  // Paginering: we tonen de nieuwste `limit` berichten en vergroten dat venster bij
  // naar beneden scrollen (loadMore). Een groeiend venster i.p.v. losse cursor-state
  // past op het full-reload-realtime-model én op het feed-index — een realtime-event
  // herlaadt simpelweg het huidige (vergrote) venster, zonder oudere posts te wissen.
  const [limit, setLimit] = useState(FEED_LIMIT);
  const [hasMore, setHasMore] = useState(false);
  // Laadfout blootgelegd zodat de Tijdlijn een banner + retry toont i.p.v. een lege feed
  // met "plaats je eerste bericht" terwijl de berichten er zijn (P0-review 2026-07-02).
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!activeId) { setPosts([]); setError(null); setLoading(false); setHasMore(false); return; }
    const { data, error: qErr } = await runResult(
      supabase
        .from('timeline_posts')
        .select('*, photos:timeline_photos ( id, photo_path, width, height, position )')
        .eq('household_id', activeId)
        // Ordening exact gelijk aan timeline_posts_feed_idx (household_id, pinned_at
        // desc nulls last, created_at desc) → geordende index-scan i.p.v. een sort per
        // load, én de juiste "top N" (een oude gepinde post valt zo niet buiten het venster).
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit),
      { context: 'tijdlijn laden' },
    );
    if (qErr) { setError(qErr); setLoading(false); return; }
    setError(null);
    const raw = data ?? [];
    setHasMore(raw.length >= limit); // vol venster → waarschijnlijk meer ouder beschikbaar
    const rows = orderTimeline(raw.map((p) => ({
      ...p,
      photos: [...(p.photos ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    })));
    setPosts(rows);
    setCached(cacheKey('timeline', activeId), rows);
    setLoading(false);
  }, [activeId, limit]);

  // Volgende pagina: vergroot het venster (triggert via load's dep een herlaad).
  const loadMore = useCallback(() => {
    if (hasMore) setLimit((l) => l + FEED_LIMIT);
  }, [hasMore]);

  // Huishouden-wissel: meteen de cache van het nieuwe huishouden tonen (of leeg) en
  // terug naar de eerste pagina (anders bewaart een vorig huishouden zijn venster).
  useEffect(() => {
    if (!key) { setPosts([]); setLoading(false); return; }
    const cached = getCached(key);
    setPosts(cached ?? []);
    setLoading(cached === undefined);
    setLimit(FEED_LIMIT);
  }, [key]);

  // Realtime: herlaad bij wijzigingen op posts én foto's, beide gefilterd op huishouden
  // (timeline_photos draagt een household_id, dus geen brede tabel-subscription).
  useRealtimeReload(load, activeId, [
    { table: 'timeline_posts', filter: `household_id=eq.${activeId}` },
    { table: 'timeline_photos', filter: `household_id=eq.${activeId}` },
  ], { name: 'timeline' });

  // Nieuw bericht: maak de post aan, upload de foto's naar de bucket en koppel de
  // foto-rijen. Foto-upload is best-effort per asset — een mislukte foto laat de post
  // staan (de tekst is al opgeslagen) i.p.v. alles te laten falen.
  const addPost = async ({ body, assets = [], visibility, shareSubgroupId, shareWith }) => {
    const vis = visibilityPayload({ visibility, shareSubgroupId, shareWith });
    const trimmed = (body ?? '').trim();
    const inserted = await mutate(
      supabase.from('timeline_posts').insert({
        household_id: activeId,
        author_id: user.id,
        body: trimmed || null,
        visibility: vis.visibility,
        share_subgroup_id: vis.share_subgroup_id,
        share_with: vis.share_with,
      }).select('id').single(),
      { context: 'bericht plaatsen' },
    );
    const postId = inserted?.id;
    if (postId && assets.length) {
      // Parallel uploaden (i.p.v. sequentieel) — merkbaar sneller op mobiel netwerk.
      // Elke foto houdt z'n eigen pad + positie; een mislukte foto laat de post staan.
      const results = await Promise.allSettled(
        assets.map(async (a, i) => {
          if (!a?.base64) return null;
          const path = photoPath(activeId, postId, `${Date.now()}-${i}`, a.ext);
          await uploadPhoto({ bucket: TIMELINE_BUCKET, path, base64: a.base64, ext: a.ext });
          return { household_id: activeId, post_id: postId, photo_path: path, width: a.width ?? null, height: a.height ?? null, position: i };
        }),
      );
      const rows = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) rows.push(r.value);
        else if (r.status === 'rejected' && typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Huishoek] Tijdlijn-foto uploaden mislukt:', r.reason?.message);
        }
      }
      if (rows.length) {
        try {
          await mutate(supabase.from('timeline_photos').insert(rows), { context: 'foto’s koppelen' });
        } catch (e) {
          // De bestanden staan al in de bucket maar de koppel-rijen zijn er niet →
          // ze zijn wezen (deletePost vindt ze nooit, want dat leest úit deze tabel).
          // Ruim ze direct op zodat storage niet langzaam vollekt.
          await supabase.storage.from(TIMELINE_BUCKET).remove(rows.map((r) => r.photo_path)).catch(() => {});
          throw e;
        }
      }
    }
    await load();
    return postId;
  };

  // Pin/ontpin een bericht (TML-2). `pinned_at` stuurt de hele ordening (orderTimeline +
  // de feed-index/`order by` in load) én de "gepind"-staat; we zetten 'm op nu of null.
  // Pinnen is zeldzaam en de realtime-reload is snel → simpel muteren + herladen.
  const setPinned = (id, pinned) =>
    mutate(
      supabase.from('timeline_posts').update({
        pinned_at: pinned ? new Date().toISOString() : null,
        pinned_by: pinned ? user.id : null, // wie pinde (voor een latere "gepind door"-weergave)
      }).eq('id', id),
      { context: pinned ? 'bericht pinnen' : 'pin verwijderen' },
    ).then(load);

  // Verwijder het bericht én ruim zijn foto-objecten in de bucket op: de FK-cascade
  // verwijdert alleen de timeline_photos-rijen, niet de Storage-bestanden (die zouden
  // anders als wezen achterblijven — zelfde opruiming als deletePlantPhoto).
  const deletePost = async (id) => {
    const photos = await run(
      supabase.from('timeline_photos').select('photo_path').eq('post_id', id),
      { fallback: [], context: 'foto-paden laden' },
    );
    const paths = (photos ?? []).map((p) => p.photo_path).filter(Boolean);
    if (paths.length) {
      // Opruimen is best-effort, maar niet stil: een mislukte remove laat wees-bestanden
      // achter (de post-rij + foto-rijen zijn straks weg via cascade). Loggen maakt het
      // diagnosticeerbaar zonder de delete te blokkeren.
      try {
        const { error } = await supabase.storage.from(TIMELINE_BUCKET).remove(paths);
        if (error) throw error;
      } catch (e) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Huishoek] Tijdlijn-foto’s opruimen mislukt (mogelijk wees-bestanden):', e.message);
        }
      }
    }
    return mutate(supabase.from('timeline_posts').delete().eq('id', id), { context: 'bericht verwijderen' });
  };

  // Verberg berichten waarvan de undo-toast nog loopt (lib/pendingDeletes.js): het
  // bericht verdwijnt meteen uit de feed, de echte delete (incl. Storage-opruiming)
  // volgt pas als de toast verloopt — tikt de gebruiker op "Ongedaan maken", dan komt
  // 'ie gewoon terug. Zelfde patroon als de uitgaven- en taken-lijst.
  useSyncExternalStore(subscribePending, pendingVersion, pendingVersion);
  const visiblePosts = posts.filter((p) => !isPending(p.id));

  return { posts: visiblePosts, loading, error, reload: load, loadMore, hasMore, addPost, setPinned, deletePost, members, user };
}
