// Pure kern van de scan-receipt Edge Function (BOO-7) — géén Deno/netwerk nodig,
// los testbaar (tests/scanReceipt.test.js). De impure schil (index.ts) doet de
// auth/rate-limit/Orq-call en gebruikt deze helpers voor validatie + normalisatie.

// MIME-whitelist (audit S-M4): alleen echte foto-formaten naar de LLM-gateway.
export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Bepaal de effectieve MIME: uit een `data:`-URL (als imageBase64 die vorm heeft),
// anders uit het losse mimeType-veld. Lowercase; null als onbekend.
export function effectiveMime(imageBase64, mimeType) {
  if (typeof imageBase64 === 'string' && imageBase64.startsWith('data:')) {
    const m = imageBase64.match(/^data:([^;,]+)[;,]/);
    if (m) return m[1].trim().toLowerCase();
  }
  return typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim().toLowerCase() : null;
}

export function isAllowedMime(mime) {
  return typeof mime === 'string' && ALLOWED_MIME.has(mime);
}

// Haal de eerste tekstuele content uit een Orq/OpenAI-achtig antwoord, in welke
// vorm dan ook (choices[].message.content kan een string of een content-array zijn).
export function extractText(data) {
  const d = data;
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
export function parseModelJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  return JSON.parse(raw);
}

export const UNITS = new Set(['stuk', 'kg', 'g', 'l', 'ml', 'pak']);
const toInt = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

// Normaliseer/saneer naar het clientcontract; gooi rommelige regels weg.
export function normalize(parsed) {
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  const clean = items
    .map((i) => {
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
