// @ts-check
// Gedeelde, pure kern van de entiteit-dagboeken (huisdier/plant/voertuig): de
// omslag-terugval bij het verwijderen van een tijdlijn-post. Die logica was letterlijk
// gedupliceerd tussen usePets (deletePetLog) en usePlants (deletePlantPhoto) — de
// review (P6, 2026-07-02) wees dat aan. We trekken hier de BESLISSING eruit (welke foto
// wordt de nieuwe omslag, en wanneer moet de omslag überhaupt herzien worden) plus een
// dunne async-orkestratie waarvan de Supabase-effecten worden ingespoten. Zo blijft deze
// module vrij van React/Supabase → node-testbaar en mutatie-bewaakt, terwijl de concrete
// queries in de (ongeteste) hook-schil blijven wonen.

// Kies de nieuwe omslag uit de resterende posts. Aanroeper levert de posts al
// nieuwste-eerst geordend aan; we nemen de eerste met een foto-pad, of null als er niets
// (met foto) rest. Een ontbrekend/leeg pad valt bewust op null terug (geen omslag).
/**
 * @param {Array<{ photo_path?: string | null }> | null | undefined} remaining
 * @returns {string | null}
 */
export function pickCoverPath(remaining) {
  return remaining?.[0]?.photo_path ?? null;
}

// Moet de omslag herzien worden na het verwijderen van deze post? Alleen als de post
// zelf een foto droeg (`removedPath`) én die foto de huidige omslag wás. Een notitie-
// only post (geen foto) of een post die niet de omslag was, laat de omslag ongemoeid.
/**
 * @param {string | null | undefined} removedPath
 * @param {string | null | undefined} currentCover
 * @returns {boolean}
 */
export function coverNeedsRefresh(removedPath, currentCover) {
  return !!removedPath && currentCover === removedPath;
}

// Verwijder een tijdlijn-post mét omslag-terugval, los van het concrete domein. De
// Supabase-afhankelijkheden komen als callbacks binnen zodat deze module puur blijft:
//   - removeObject(path): het storage-object weghalen (best-effort; alleen bij een foto)
//   - deleteRow(id):      de log-/foto-rij verwijderen
//   - fetchRemaining():   de resterende posts-met-foto opvragen (nieuwste eerst)
//   - setCover(next):     het omslag-pad op de parent-entiteit zetten
// Was de verwijderde post de omslag, dan valt de omslag terug op de nieuwste resterende
// foto (of null). Geeft het (mogelijk nieuwe) omslag-pad terug — net als de oude,
// gedupliceerde implementaties.
/**
 * @param {{
 *   entry: { id: any, photo_path?: string | null },
 *   parentCover: string | null,
 *   removeObject: (path: string) => Promise<any>,
 *   deleteRow: (id: any) => Promise<any>,
 *   fetchRemaining: () => Promise<Array<{ photo_path?: string | null }> | null | undefined>,
 *   setCover: (next: string | null) => Promise<any>,
 * }} args
 * @returns {Promise<string | null>}
 */
export async function deleteDiaryEntryWithCover({
  entry, parentCover, removeObject, deleteRow, fetchRemaining, setCover,
}) {
  if (entry.photo_path) await removeObject(entry.photo_path);
  await deleteRow(entry.id);

  if (coverNeedsRefresh(entry.photo_path, parentCover)) {
    const next = pickCoverPath(await fetchRemaining());
    await setCover(next);
    return next;
  }
  return parentCover ?? null;
}
