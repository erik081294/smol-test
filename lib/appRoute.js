// Pure routerbeslissing voor de app-gate (zie app/_layout.js). Géén React/native,
// zodat hij in node te unit-testen is. Geeft één van vier toestanden:
//   'loading'    — auth of huishoudens laden nog; toon het wachtscherm, redirect niet.
//   'auth'       — niet ingelogd.
//   'onboarding' — ingelogd, maar (na een echte fetch) geen huishouden.
//   'app'        — ingelogd mét huishouden.
//
// Cruciaal: 'onboarding' mag pas vallen ná een echte fetch (`hasFetched`), anders
// flitst het "Huishouden aanmaken"-scherm tijdens het laden (UX-8). Een lege lijst
// die nog niet is opgehaald telt dus níet als "geen huishouden".
export function appRoute({ authLoading, session, hhLoading, hasFetched, households }) {
  if (authLoading || (session && (hhLoading || !hasFetched))) return 'loading';
  if (!session) return 'auth';
  if ((households?.length ?? 0) === 0) return 'onboarding';
  return 'app';
}
