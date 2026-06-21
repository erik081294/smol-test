// Supabase Edge Function: scan-receipt (BOO-7, AI-bonextractie / "trap 3").
//
// Neemt een bon-foto van de (ingelogde) client en laat een multimodaal model de
// bon uitlezen tot gestructureerde JSON — winkel, datum en regels met prijzen.
// De LLM-call loopt via de Orq.ai AI Gateway (model-router), zodat de API-sleutel
// server-side blijft (nooit in de app-bundle) en het model in het Orq-dashboard
// te wisselen is zonder deze functie opnieuw te deployen.
//
// Contract terug naar de client (bedragen in HELE CENTEN, int):
//   { store: string|null, purchased_on: "YYYY-MM-DD"|null,
//     items: [{ name, quantity, unit, unit_price_cents, line_total_cents }] }
//
// De extractie is een hulpmiddel, geen waarheid: de client toont het resultaat in
// de bewerkbare bon-editor met totaal-controle, zodat de gebruiker corrigeert vóór
// opslaan (het vangnet uit docs/plans/02-boodschappen-intelligentie.md).
//
// Vereiste secrets (zie docs/orq-receipt-scan.md):
//   ORQ_API_KEY         — Orq.ai API-sleutel
//   ORQ_DEPLOYMENT_KEY  — sleutel van de Orq-deployment (default 'receipt-extractor')
//
// Hardening (INF-9 / audit S-M4): per-gebruiker rate-limit (DB-RPC `record_receipt_scan`,
// migratie 0026) + MIME-whitelist, beide vóór de betaalde Orq-call.

// @ts-ignore — Deno laadt het .js-buurbestand; types niet nodig in deze schil.
import { extractText, parseModelJson, normalize, effectiveMime, isAllowedMime } from './core.js';

const ORQ_INVOKE_URL = 'https://api.orq.ai/v2/deployments/invoke';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // ~8MB base64-payload; grotere foto's weigeren
const SCAN_MAX_PER_WINDOW = 20;          // max scans per gebruiker...
const SCAN_WINDOW_SECONDS = 3600;        // ...per uur (schuivend venster)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

// De instructie die we als gebruikersbericht bij de foto sturen. De Orq-deployment
// mag hetzelfde nog eens in zijn system-prompt zetten; dit maakt de functie robuust
// óók bij een minimaal geconfigureerde deployment.
const INSTRUCTION = `Je krijgt een foto van een kassabon. Lees de bon uit en geef UITSLUITEND geldige JSON terug met exact deze vorm:
{"store": <winkelnaam of null>, "purchased_on": <datum als "YYYY-MM-DD" of null>, "items": [{"name": <productnaam zoals op de bon>, "quantity": <aantal, getal>, "unit": <"stuk"|"kg"|"g"|"l"|"ml"|"pak">, "unit_price_cents": <prijs per stuk in hele centen, geheel getal>, "line_total_cents": <regeltotaal in hele centen, geheel getal>}]}
Regels: bedragen in hele centen (1,29 euro -> 129). Sla statiegeld, kortingen, subtotalen en het eindtotaal NIET als item op. Bij twijfel over een eenheid gebruik "stuk". Geen tekst buiten de JSON, geen markdown-codeblok.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Methode niet toegestaan' }, 405);

  const ORQ_API_KEY = Deno.env.get('ORQ_API_KEY');
  const DEPLOYMENT_KEY = Deno.env.get('ORQ_DEPLOYMENT_KEY') ?? 'receipt-extractor';
  if (!ORQ_API_KEY) return json({ error: 'Bonscan is niet geconfigureerd (ORQ_API_KEY ontbreekt).' }, 503);

  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ongeldige aanvraag' }, 400);
  }
  const { imageBase64, mimeType } = body;
  if (!imageBase64) return json({ error: 'Geen afbeelding meegegeven' }, 400);
  if (imageBase64.length > MAX_IMAGE_BYTES) return json({ error: 'Foto te groot — maak een kleinere of scherpere foto.' }, 413);

  // MIME-whitelist: alleen echte foto-formaten naar de LLM-gateway.
  const mime = effectiveMime(imageBase64, mimeType);
  if (!isAllowedMime(mime)) {
    return json({ error: 'Niet-ondersteund bestandstype — gebruik een JPEG-, PNG- of WebP-foto.' }, 415);
  }

  // Rate-limit per gebruiker vóór de betaalde Orq-call. De functie draait achter
  // verify_jwt, dus het Authorization-JWT identificeert de gebruiker; de RPC telt
  // het schuivende venster. Fail-open bij infra-fouten (een storing in de teller
  // mag het scannen niet breken), fail-closed bij een expliciete over-de-limiet.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (SUPABASE_URL && SUPABASE_ANON_KEY && authHeader) {
    try {
      const rl = await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_receipt_scan`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, authorization: authHeader, 'content-type': 'application/json' },
        body: JSON.stringify({ p_max: SCAN_MAX_PER_WINDOW, p_window_seconds: SCAN_WINDOW_SECONDS }),
      });
      if (rl.ok) {
        const allowed = await rl.json().catch(() => true);
        if (allowed === false) {
          return json({ error: 'Te veel bonscans in korte tijd — probeer het straks opnieuw.' }, 429);
        }
      } else {
        console.warn('[scan-receipt] rate-limit-check status', rl.status);
      }
    } catch (e) {
      console.warn('[scan-receipt] rate-limit-check faalde (fail-open)', String(e));
    }
  }

  const dataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}`;

  let orqRes: Response;
  try {
    orqRes = await fetch(ORQ_INVOKE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ORQ_API_KEY}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        key: DEPLOYMENT_KEY,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: INSTRUCTION },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return json({ error: 'Kon de bonscan-service niet bereiken', detail: String(e) }, 502);
  }

  if (!orqRes.ok) {
    const detail = await orqRes.text().catch(() => '');
    console.error('[scan-receipt] Orq-fout', orqRes.status, detail.slice(0, 500));
    return json({ error: 'De bonscan mislukte', status: orqRes.status }, 502);
  }

  const data = await orqRes.json().catch(() => null);
  const text = extractText(data);
  if (!text) {
    console.error('[scan-receipt] Geen tekst in Orq-antwoord', JSON.stringify(data)?.slice(0, 500));
    return json({ error: 'Kon de bon niet uitlezen' }, 502);
  }

  let parsed: any;
  try {
    parsed = parseModelJson(text);
  } catch {
    console.error('[scan-receipt] JSON-parse mislukt', text.slice(0, 500));
    return json({ error: 'De bon kon niet als gegevens worden gelezen — probeer een scherpere foto of voer handmatig in.' }, 422);
  }

  return json(normalize(parsed));
});
