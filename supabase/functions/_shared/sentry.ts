// Edge-foutrapportage naar Sentry (INF-4) — GEEN dependency: een minimaal store-event
// via plain fetch naar het DSN-store-endpoint. Volledig fail-silent: monitoring mag
// nooit een request breken (try/catch om alles + korte timeout), en zonder de
// function-secret SENTRY_DSN is dit een no-op. De pure kern (DSN-parse/event-vorm)
// staat in ./sentryCore.js en is unit-getest; hier alleen de dunne Deno-glue.
//
// Datahygiëne: alleen een korte vaste melding + kleine tags (function-naam/stap) —
// geen user-ids, geen request-payloads (zelfde discipline als de gehashte
// Orq-trace-metadata in assistant/index.ts).
//
// End-to-end verifiëren (event zichtbaar in het Sentry-dashboard) kan pas met een
// echte DSN in de edge-secrets — aparte stap met Erik; in deze omgeving is er geen.

// @ts-ignore — Deno laadt het .js-buurbestand; types via @ts-check in dat bestand.
import { parseDsn, storeUrl, buildStoreEvent, eventMessage } from './sentryCore.js';

/**
 * Meld een edge-fout aan Sentry. `fn` = function-naam ('assistant'/'scan-receipt'),
 * `label` = korte vaste omschrijving van het catch-pad, `error` = de gevangen fout
 * (optioneel), `tags` = extra kleine labels (bv. { stage: 'orq' }).
 */
export async function reportEdgeError(
  fn: string,
  label: string,
  error?: unknown,
  tags: Record<string, string> = {},
): Promise<void> {
  try {
    const parsed = parseDsn(Deno.env.get('SENTRY_DSN') ?? '');
    if (!parsed) return; // geen/onbruikbare DSN → no-op
    const event = buildStoreEvent({
      message: eventMessage(label, error),
      level: 'error',
      tags: { function: fn, ...tags },
      timestamp: new Date().toISOString(),
    });
    await fetch(storeUrl(parsed), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      // Kort en begrensd: een traag/hangend Sentry-endpoint mag het (toch al
      // falende) request niet nog seconden extra ophouden.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Fail-silent — bewust leeg: monitoring breekt nooit de bestaande foutafhandeling.
  }
}
