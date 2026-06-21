-- ============================================================================
-- HUISHOEK — 0023: Push-leveringen (PLT-1, trap 2 — idempotentie + audit)
-- ============================================================================
-- Eén rij per verstuurde remote push. De Edge Function `notify` claimt vóór het
-- versturen een `dedup_key` (insert … on conflict do nothing): bestaat die al,
-- dan is de push al verstuurd en slaat de functie 'm over. Dit voorkomt dubbele
-- meldingen bij een herhaalde Database-Webhook-fire, en levert meteen een
-- audit-spoor dat later de activiteitenfeed (PLT-6) kan voeden.
--
-- Alleen de service-role (binnen de functie) schrijft/leest deze tabel. RLS staat
-- AAN zonder policies: reguliere (anon/authenticated) clients kunnen er niets mee;
-- de service-role omzeilt RLS. Geen FK op `recipient_id` zodat een insert nooit
-- faalt op een (net) verwijderd profiel — een audit-spoor mag een 'wees' bevatten.
-- ============================================================================

create table if not exists public.push_deliveries (
  dedup_key    text primary key,
  recipient_id uuid,
  kind         text,
  created_at   timestamptz not null default now()
);

create index if not exists push_deliveries_recipient_idx
  on public.push_deliveries (recipient_id, created_at desc);

alter table public.push_deliveries enable row level security;
-- Bewust géén policies: dichtgetimmerd voor reguliere clients; de service-role
-- (gebruikt door de Edge Function) omzeilt RLS en kan wel schrijven/lezen.
