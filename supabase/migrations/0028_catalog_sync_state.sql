-- ============================================================================
-- HUISHOEK — 0028: sync-state voor de OFF-catalogus delta-refresh
-- ============================================================================
-- De catalogus (0014) wordt nu uit de OFF data-dump gevuld. Om 'm vers te houden
-- zónder telkens de volle ~7 GB dump te halen, passen we OFF's DAGELIJKSE DELTA's toe
-- (14 dagen bewaard). Daarvoor onthouden we een watermerk: de grootste "laatste
-- wijziging"-timestamp die we al verwerkt hebben. Dit staat bewust in de DB (niet in
-- een lokaal bestand) zodat de sync stateful + herhaalbaar is over runs/machines/CI.
--
-- Eén rij (id = 'off-delta'). RLS aan, geen policies: alleen de service-role
-- (importscript / scheduled job) raakt deze tabel.
-- ============================================================================
create table if not exists public.catalog_sync_state (
  id                 text primary key,
  last_delta_ts      bigint      not null default 0,   -- grootste verwerkte OFF-wijziging (UNIX-s)
  last_run_at        timestamptz,
  last_applied_files int         not null default 0,
  updated_at         timestamptz not null default now()
);

insert into public.catalog_sync_state (id) values ('off-delta')
on conflict (id) do nothing;

alter table public.catalog_sync_state enable row level security;
