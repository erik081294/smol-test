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

const ORQ_INVOKE_URL = 'https://api.orq.ai/v2/deployments/invoke';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // ~8MB base64-payload; grotere foto's weigeren

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

// Haal de eerste tekstuele content uit een Orq/OpenAI-achtig antwoord, in welke
// vorm dan ook (choices[].message.content kan een string of een content-array zijn).
function extractText(data: unknown): string | null {
  const d = data as Record<string, any>;
  const choice = d?.choices?.[0]?.message ?? d?.message ?? d;
  const content = choice?.content ?? d?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((c) => typeof c?.text === 'string');
    if (textPart) return textPart.text;
  }
  if (typeof choice?.text === 'string') return choice.text;
  return null;
}

// Parse de model-JSON tolerant: strip een eventueel ```json ... ``` codeblok.
function parseModelJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  return JSON.parse(raw);
}

const UNITS = new Set(['stuk', 'kg', 'g', 'l', 'ml', 'pak']);
const toInt = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

// Normaliseer/saneer naar het clientcontract; gooi rommelige regels weg.
function normalize(parsed: any) {
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const clean = items
    .map((i: any) => {
      const name = typeof i?.name === 'string' ? i.name.trim() : '';
      if (!name) return null;
      const qty = Number(i?.quantity);
      const unit = UNITS.has(i?.unit) ? i.unit : 'stuk';
      return {
        name,
        quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
        unit,
        unit_price_cents: toInt(i?.unit_price_cents),
        line_total_cents: toInt(i?.line_total_cents),
      };
    })
    .filter(Boolean);
  const date = typeof parsed?.purchased_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchased_on)
    ? parsed.purchased_on
    : null;
  return {
    store: typeof parsed?.store === 'string' && parsed.store.trim() ? parsed.store.trim() : null,
    purchased_on: date,
    items: clean,
  };
}

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
