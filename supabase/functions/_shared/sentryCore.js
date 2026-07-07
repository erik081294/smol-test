// @ts-check
// Pure kern van de edge-foutrapportage (INF-4): DSN-parse + minimaal Sentry-store-
// event, zónder dependency. De Deno-schil (./sentry.ts) POST het gebouwde event met
// plain fetch naar het store-endpoint. Dit bestand blijft bewust puur (geen Deno,
// geen fetch, geen klok) zodat het met node:test te unit-testen is en onder de
// mutatie-ratchet + typecheck-poort valt (tests/sentryCore.test.js).
//
// Store-endpoint (Sentry event-payload v7):
//   https://<host>/api/<projectId>/store/?sentry_version=7&sentry_key=<publicKey>
// Auth gaat volledig via de query-string — geen header, geen secret key nodig.

// Maximaal aantal tekens dat we van een melding meesturen: genoeg voor context, te
// weinig voor payload-dumps (datahygiëne — geen rij-inhoud/PII in de melding; zelfde
// discipline als de gehashte Orq-trace-metadata in assistant/index.ts).
export const MAX_MESSAGE_CHARS = 500;

/** @typedef {{ host: string, projectId: string, publicKey: string }} ParsedDsn */

/**
 * Parseert een Sentry-DSN (`https://<publicKey>@<host>/<projectId>`) naar zijn
 * onderdelen. Het projectId is het laatste pad-segment (volledig numeriek). Geeft
 * null bij alles wat geen bruikbare DSN is (leeg/geen string/geen key/geen numeriek
 * project) — de aanroeper behandelt null als "monitoring uit". Geen aparte
 * type-/trim-guard nodig: de URL-constructor weigert niet-URL's zelf (throw → null)
 * en stript rand-witruimte volgens de URL-spec.
 * @param {unknown} dsn
 * @returns {ParsedDsn | null}
 */
export function parseDsn(dsn) {
  let url;
  try {
    url = new URL(String(dsn));
  } catch {
    return null;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const projectId = segments[segments.length - 1] ?? '';
  if (!url.username || !/^\d+$/.test(projectId)) return null;
  return { host: url.host, projectId, publicKey: url.username };
}

/**
 * Het store-endpoint voor een geparste DSN — exact de vorm hierboven.
 * @param {ParsedDsn} parsed
 * @returns {string}
 */
export function storeUrl({ host, projectId, publicKey }) {
  return `https://${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;
}

/**
 * Korte event-melding: 'label: <fout>', geklemd op MAX_MESSAGE_CHARS; zonder fout
 * alleen het label. String(error) kán een payload bevatten — de klem beperkt dat.
 * @param {unknown} [label]
 * @param {unknown} [error]
 * @returns {string}
 */
export function eventMessage(label, error) {
  const base = String(label ?? '').trim();
  if (error === undefined || error === null) return base.slice(0, MAX_MESSAGE_CHARS);
  return `${base}: ${String(error)}`.slice(0, MAX_MESSAGE_CHARS);
}

/**
 * Minimaal Sentry-store-event: message + level + tags (+ optioneel timestamp).
 * Puur — het tijdstip komt van de aanroeper (de Deno-schil geeft een ISO-string
 * mee), zodat de vorm hier exact te pinnen is.
 * @param {{ message?: unknown, level?: string, tags?: Record<string, string>, timestamp?: string }} [opts]
 * @returns {{ message: string, level: string, platform: string, tags: Record<string, string>, timestamp?: string }}
 */
export function buildStoreEvent({ message, level = 'error', tags = {}, timestamp } = {}) {
  return {
    message: String(message ?? '').slice(0, MAX_MESSAGE_CHARS),
    level,
    platform: 'javascript',
    ...(timestamp ? { timestamp } : {}),
    tags,
  };
}
