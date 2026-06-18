// Beurtrotatie (KLU-4) — pure logica, los van Supabase/React.
//
// Een terugkerende taak kan een rotatie hebben: een geordende lijst van
// profiel-ids. assigned_to is dan "de huidige beurt". Bij het doorrollen springt
// de toewijzing naar de volgende in de lijst (wrap-around).

// Volgende toegewezene na de huidige (wrap-around).
//   - lege/ontbrekende rotatie        -> null
//   - current niet in de lijst (of null) -> eerste in de rotatie
//   - laatste in de lijst             -> weer de eerste
export function nextAssignee(rotation = [], current = null) {
  const list = Array.isArray(rotation) ? rotation.filter(Boolean) : [];
  if (list.length === 0) return null;
  const i = list.indexOf(current);
  if (i === -1) return list[0];
  return list[(i + 1) % list.length];
}
