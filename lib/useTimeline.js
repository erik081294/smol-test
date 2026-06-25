import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { useHousehold } from './household';
import { useAuth } from './auth';
import { run, mutate } from './db';
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

  const load = useCallback(async () => {
    if (!activeId) { setPosts([]); setLoading(false); return; }
    const data = await run(
      supabase
        .from('timeline_posts')
        .select('*, photos:timeline_photos ( id, photo_path, width, height, position )')
        .eq('household_id', activeId)
        .order('created_at', { ascending: false })
        .limit(FEED_LIMIT),
      { fallback: [], context: 'tijdlijn laden' },
    );
    const rows = orderTimeline((data ?? []).map((p) => ({
      ...p,
      photos: [...(p.photos ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    })));
    setPosts(rows);
    setCached(cacheKey('timeline', activeId), rows);
    setLoading(false);
  }, [activeId]);

  // Huishouden-wissel: meteen de cache van het nieuwe huishouden tonen (of leeg).
  useEffect(() => {
    if (!key) { setPosts([]); setLoading(false); return; }
    const cached = getCached(key);
    setPosts(cached ?? []);
    setLoading(cached === undefined);
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
      const rows = [];
      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        if (!a?.base64) continue;
        const path = photoPath(activeId, postId, `${Date.now()}-${i}`, a.ext);
        try {
          await uploadPhoto({ bucket: TIMELINE_BUCKET, path, base64: a.base64, ext: a.ext });
          rows.push({ household_id: activeId, post_id: postId, photo_path: path, width: a.width ?? null, height: a.height ?? null, position: i });
        } catch (e) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[Huishoek] Tijdlijn-foto uploaden mislukt:', e.message);
        }
      }
      if (rows.length) {
        await mutate(supabase.from('timeline_photos').insert(rows), { context: 'foto’s koppelen' });
      }
    }
    await load();
    return postId;
  };

  // Verwijder het bericht én ruim zijn foto-objecten in de bucket op: de FK-cascade
  // verwijdert alleen de timeline_photos-rijen, niet de Storage-bestanden (die zouden
  // anders als wezen achterblijven — zelfde opruiming als deletePlantPhoto).
  const deletePost = async (id) => {
    const photos = await run(
      supabase.from('timeline_photos').select('photo_path').eq('post_id', id),
      { fallback: [], context: 'foto-paden laden' },
    );
    const paths = (photos ?? []).map((p) => p.photo_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(TIMELINE_BUCKET).remove(paths).catch(() => {});
    return mutate(supabase.from('timeline_posts').delete().eq('id', id), { context: 'bericht verwijderen' });
  };

  // Verberg berichten waarvan de undo-toast nog loopt (lib/pendingDeletes.js): het
  // bericht verdwijnt meteen uit de feed, de echte delete (incl. Storage-opruiming)
  // volgt pas als de toast verloopt — tikt de gebruiker op "Ongedaan maken", dan komt
  // 'ie gewoon terug. Zelfde patroon als de uitgaven- en taken-lijst.
  useSyncExternalStore(subscribePending, pendingVersion, pendingVersion);
  const visiblePosts = posts.filter((p) => !isPending(p.id));

  return { posts: visiblePosts, loading, reload: load, addPost, deletePost, members, user };
}
