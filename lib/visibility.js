// Pure helpers rond zichtbaarheid, gedeeld door alle modules (taken, boodschappen,
// en latere modules). Géén React/Supabase hier — zo blijven ze los te unit-testen
// en is er één bron van waarheid voor de payload-vorm die de DB verwacht.
import { VISIBILITY } from './constants';

// Bouwt de zichtbaarheids-kolommen voor een module-rij. Gooit de irrelevante
// velden weg zodat een 'household'-item nooit een verdwaalde subgroep/share houdt.
export function visibilityPayload({ visibility, shareSubgroupId = null, shareWith = [] } = {}) {
  const v = visibility ?? VISIBILITY.HOUSEHOLD;
  return {
    visibility: v,
    share_subgroup_id: v === VISIBILITY.SUBGROUP ? (shareSubgroupId ?? null) : null,
    share_with: v === VISIBILITY.CUSTOM ? (shareWith ?? []) : null,
  };
}

// Valideert een zichtbaarheidskeuze vóór opslaan. Geeft een NL-foutmelding terug,
// of null als alles klopt. De DB dwingt dit ook af (CHECK + RLS), maar zo krijgt
// de gebruiker een nette melding i.p.v. een ruwe databasefout.
export function validateVisibility({ visibility, shareSubgroupId, shareWith } = {}) {
  if (visibility === VISIBILITY.SUBGROUP && !shareSubgroupId) {
    return 'Kies een groep om mee te delen.';
  }
  if (visibility === VISIBILITY.CUSTOM && (!shareWith || shareWith.length === 0)) {
    return 'Kies met wie je dit deelt, of kies het hele huishouden.';
  }
  return null;
}

// Spiegelt public.can_view uit de database: mag een viewer dit item zien?
// Bewust een 1-op-1 kopie van de SQL-regels zodat de logica in JS te testen is
// en de UI lokaal kan filteren zonder rondje langs de server.
export function canView(viewer, item, { householdMemberIds = [], subgroupMemberIds = [] } = {}) {
  if (!householdMemberIds.includes(viewer)) return false;
  const v = item.visibility ?? VISIBILITY.HOUSEHOLD;
  const creator = item.created_by ?? item.added_by ?? null;
  if (v === VISIBILITY.HOUSEHOLD) return true;
  if (creator && creator === viewer) return true;
  if (v === VISIBILITY.SUBGROUP) return subgroupMemberIds.includes(viewer);
  if (v === VISIBILITY.CUSTOM) return (item.share_with ?? []).includes(viewer);
  return false;
}
