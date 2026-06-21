// Edge Function `notify` — remote push voor PLT-1 (trap 2).
//
// Een Database Webhook op `public.tasks` (INSERT + UPDATE) roept deze functie aan;
// de functie stuurt de toegewezene een Expo-push. De WAT/WIE-beslissing leeft in
// `./core.js` (puur + unit-getest in `tests/notify.test.js`); deze schil doet de
// impure dingen: secret-check, idempotentie, tokens ophalen (service-role),
// versturen en dode tokens opruimen.
//
// Deploy, webhook en toesteltest: zie docs/notify-setup.md.
//   `verify_jwt = false` (supabase/config.toml) — DB-webhooks dragen geen user-JWT,
//   dus de functie is publiek bereikbaar en wordt beschermd met een gedeeld geheim
//   (header `x-notify-secret` moet gelijk zijn aan env `NOTIFY_WEBHOOK_SECRET`).
//   `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` worden automatisch geïnjecteerd.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildIntents, expoMessages, chunk, EXPO_PUSH_URL, EXPO_MAX_BATCH } from './core.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  try {
    // 1) Beveiliging: gedeeld geheim. Alleen afdwingen als het secret gezet is,
    //    zodat een lokale dev-omgeving zonder secret blijft werken.
    const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (secret && req.headers.get('x-notify-secret') !== secret) {
      return json({ error: 'unauthorized' }, 401);
    }

    const payload = await req.json();
    const intents = buildIntents(payload);
    if (intents.length === 0) return json({ processed: 0, skipped: 'geen relevante intent' });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let sent = 0;
    let pruned = 0;
    let skipped = 0;

    for (const intent of intents) {
      // 2) Idempotentie: claim de dedupKey. `ignoreDuplicates` → bij een bestaande
      //    sleutel komt er niets terug, en is de push dus al eerder verstuurd.
      const { data: claimed, error: claimErr } = await admin
        .from('push_deliveries')
        .upsert(
          { dedup_key: intent.dedupKey, recipient_id: intent.recipientId, kind: intent.kind },
          { onConflict: 'dedup_key', ignoreDuplicates: true },
        )
        .select('dedup_key');
      if (claimErr) throw claimErr;
      if (!claimed || claimed.length === 0) { skipped++; continue; }

      // 3) Tokens van de ontvanger (service-role; RLS verbergt andermans tokens).
      const { data: tokenRows, error: tokErr } = await admin
        .from('push_tokens')
        .select('token')
        .eq('profile_id', intent.recipientId);
      if (tokErr) throw tokErr;
      const tokens = (tokenRows ?? []).map((r) => r.token as string);
      if (tokens.length === 0) { skipped++; continue; }

      // 4) Versturen in batches van max 100; verzamel de tickets voor opruiming.
      const messages = expoMessages(tokens, intent);
      const tickets: any[] = [];
      for (const batch of chunk(messages, EXPO_MAX_BATCH)) {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch),
        });
        const out = await res.json().catch(() => ({}));
        if (Array.isArray(out?.data)) tickets.push(...out.data);
        sent += batch.length;
      }

      // 5) Dode tokens opruimen: een ticket met `DeviceNotRegistered` hoort op
      //    dezelfde index bij zijn token (zelfde volgorde als `expoMessages`).
      const dead = tickets
        .map((t, i) => (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered' ? tokens[i] : null))
        .filter((x): x is string => Boolean(x));
      if (dead.length) {
        const { error: delErr } = await admin
          .from('push_tokens')
          .delete()
          .eq('profile_id', intent.recipientId)
          .in('token', dead);
        if (!delErr) pruned += dead.length;
      }
    }

    return json({ processed: intents.length, sent, pruned, skipped });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
