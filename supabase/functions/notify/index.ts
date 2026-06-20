// Edge Function `notify` — remote push voor PLT-1 (trap 2).
//
// Stuurt een Expo-push naar de toegewezene van een taak. Bedoeld als Database
// Webhook op INSERT/UPDATE van `public.tasks`: als `assigned_to` is gezet en
// verschilt van de maker, krijgt die persoon een melding.
//
// Deploy:  supabase functions deploy notify
// Webhook: Dashboard → Database → Webhooks → tabel `tasks`, events insert+update,
//          type "Supabase Edge Functions" → functie `notify`.
// Secrets: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden automatisch geïnjecteerd
//          in de functie-omgeving.
//
// Het opzoeken van de push-tokens gebeurt met de SERVICE-ROLE (mede-leden mogen
// elkaars token niet via RLS lezen). De functie verstuurt naar de Expo Push API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook-vorm: { type, table, record, old_record }.
    const record = payload.record ?? payload;
    const oldRecord = payload.old_record ?? null;

    const assignee = record?.assigned_to;
    const creator = record?.created_by;
    if (!assignee || assignee === creator) {
      return new Response(JSON.stringify({ skipped: 'geen relevante toewijzing' }), { status: 200 });
    }
    // Bij UPDATE alleen sturen als de toewijzing daadwerkelijk wijzigde.
    if (oldRecord && oldRecord.assigned_to === assignee) {
      return new Response(JSON.stringify({ skipped: 'toewijzing ongewijzigd' }), { status: 200 });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokens, error } = await admin
      .from('push_tokens')
      .select('token')
      .eq('profile_id', assignee);
    if (error) throw error;
    if (!tokens?.length) {
      return new Response(JSON.stringify({ skipped: 'geen tokens' }), { status: 200 });
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title: 'Nieuwe taak voor jou',
      body: record.title ?? 'Je hebt een taak toegewezen gekregen',
      sound: null,
    }));

    const res = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    return new Response(JSON.stringify({ sent: messages.length, result }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
