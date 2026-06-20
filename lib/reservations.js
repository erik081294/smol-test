// Pure logica voor gedeelde resources & reserveringen (AUT-1/AUT-2). Géén
// React/Supabase. Zie docs/plans/04-kosten-autodelen.md.
import { parseISO, format, eachDayOfInterval, startOfDay } from 'date-fns';

const toDate = (d) => (d instanceof Date ? d : parseISO(String(d)));

// Overlappen twee intervallen [aStart,aEnd) en [bStart,bEnd)? Rakend (aEnd==bStart)
// telt NIET als overlap.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = toDate(aStart), ae = toDate(aEnd), bs = toDate(bStart), be = toDate(bEnd);
  return as < be && bs < ae;
}

// Botst een (nieuwe of bewerkte) reservering met bestaande op dezelfde resource?
//   candidate: { id?, starts_at, ends_at }; existing: [{ id, starts_at, ends_at }]
// Een bestaande met dezelfde id is de reservering zelf en telt niet mee (bewerken).
export function hasConflict(candidate, existing = []) {
  return existing.some((r) =>
    r.id !== candidate.id &&
    overlaps(candidate.starts_at, candidate.ends_at, r.starts_at, r.ends_at));
}

// Reserveringen die een gegeven dag raken (voor de kalender-dagcellen).
export function onDay(reservations = [], day) {
  const d = toDate(day);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return reservations.filter((r) => overlaps(r.starts_at, r.ends_at, start, end));
}

// Reserveringen per kalenderdag voor de maandweergave. Een reservering die meerdere
// dagen beslaat verschijnt op elke dag. Een eindtijd op exact middernacht telt niet
// mee voor die laatste dag ([start, eind) is half-open). -> { 'yyyy-MM-dd': [r, …] }
export function reservationsByDay(reservations = []) {
  const out = {};
  for (const r of reservations) {
    const s = toDate(r.starts_at), e = toDate(r.ends_at);
    if (!(s < e)) continue;
    const last = new Date(e.getTime() - 1); // 1 ms terug zodat exact-middernacht-eind afvalt
    for (const d of eachDayOfInterval({ start: startOfDay(s), end: startOfDay(last) })) {
      (out[format(d, 'yyyy-MM-dd')] ??= []).push(r);
    }
  }
  return out;
}

// Gebruik per persoon -> deelnemers met gewicht, klaar voor computeShares
// (splitType 'shares'). Sommeert per persoon en negeert 0/ontbrekend gebruik.
//   reservations: [{ profile_id, usage_value }]
export function usageParticipants(reservations = []) {
  const byPerson = new Map();
  for (const r of reservations) {
    const u = Number(r.usage_value) || 0;
    if (u <= 0) continue;
    byPerson.set(r.profile_id, (byPerson.get(r.profile_id) ?? 0) + u);
  }
  return [...byPerson.entries()].map(([profileId, weight]) => ({ profileId, weight }));
}
