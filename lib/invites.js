// @ts-check
// Pure logica voor het persoonlijke uitnodigingssysteem (PLT-7). Géén React/Supabase,
// zodat dit in node te unit-testen is. Web-first & account-gebonden: een invite is een
// hoog-entropie token met 24u-expiry, eenmalig en intrekbaar. De RPC-calls (create/peek/
// accept/revoke) staan in lib/household.js; hier alleen de pure helpers.

// Basis-URL van de web-app waar /join/<token> op uitkomt. Op web overschrijft het scherm
// dit met window.location.origin; dit is de native/fallback-waarde.
export const WEB_BASE_URL = 'https://huishoek.app';

// Status van een invite-rij op een moment. De volgorde is bewust: ingetrokken en
// geaccepteerd winnen van verlopen (een ingetrokken-én-verlopen invite heet 'revoked').
// Grens: precies óp expires_at telt al als verlopen (<=).
export function inviteStatus(invite, now = new Date()) {
  if (!invite) return 'invalid';
  if (invite.revoked_at) return 'revoked';
  if (invite.accepted_at) return 'accepted';
  const exp = invite.expires_at ? new Date(invite.expires_at).getTime() : null;
  if (exp != null && exp <= toMs(now)) return 'expired';
  return 'valid';
}

// Is de invite nú nog in te wisselen? Alleen 'valid' telt.
export function isRedeemable(invite, now = new Date()) {
  return inviteStatus(invite, now) === 'valid';
}

// Hele uren tot het verlopen (afgerond, nooit negatief; 0 zodra verlopen of zonder
// expires_at). Pure helper zodat de UI geen Date.now() in render hoeft te roepen.
export function hoursUntilExpiry(invite, now = new Date()) {
  if (!invite || !invite.expires_at) return 0;
  const ms = new Date(invite.expires_at).getTime() - toMs(now);
  return Math.max(0, Math.round(ms / 3600000));
}

// Bouwt de deelbare web-link. Strip trailing slashes van de basis en URL-encodet het
// token. Lege/ontbrekende basis → de WEB_BASE_URL-fallback.
export function inviteUrl(token, baseUrl = WEB_BASE_URL) {
  const base = String(baseUrl || WEB_BASE_URL).replace(/\/+$/, '');
  return `${base}/join/${encodeURIComponent(String(token ?? ''))}`;
}

// Haalt een token uit ruwe invoer: een geplakte volledige link (…/join/<token>) óf het
// token zelf. Strip whitespace, query/hash en pad. Geeft '' bij niets bruikbaars.
export function normalizeToken(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  s = s.split(/[?#]/)[0]; // query/hash eraf
  const marker = '/join/';
  const at = s.indexOf(marker);
  if (at !== -1) s = s.slice(at + marker.length);
  if (s.includes('/')) s = s.split('/').filter(Boolean).pop() ?? '';
  return s.trim();
}

function toMs(now) {
  return now instanceof Date ? now.getTime() : new Date(now).getTime();
}
