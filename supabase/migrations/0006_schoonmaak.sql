-- ============================================================================
-- HUISHOEK — 0006: Schoonmaak (zones + roosterkoppeling op tasks)
-- ============================================================================
-- Schoonmaak krijgt GEEN eigen takentabel en GEEN nieuwe categorie: een
-- schoonmaaktaak is een gewone task met category 'huishouden' (label "Huishouden",
-- 🧹) plus een zone_id. Zo erft het de hele terugkeer-, toewijzings- en
-- zichtbaarheidslogica van Klussen (DRY) en blijft lib/constants.js in sync met
-- de bestaande CHECK-constraint.
--
-- Nieuw is alleen de zone-laag: per ruimte/zone een set terugkerende taken,
-- bedoeld om in één keer via een sjabloon op te zetten (zie lib/cleaningTemplates.js).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Zones: lichte structuur per huishouden. Geen "item", dus NIET het volledige
--    can_view-contract — gewoon: lid van het huishouden mag alles.
-- ---------------------------------------------------------------------------
create table if not exists public.zones (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  emoji        text not null default '🧹',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists zones_household_idx on public.zones(household_id);

alter table public.zones enable row level security;

drop policy if exists zones_select on public.zones;
create policy zones_select on public.zones for select using (public.is_member(household_id));
drop policy if exists zones_insert on public.zones;
create policy zones_insert on public.zones for insert with check (public.is_member(household_id));
drop policy if exists zones_update on public.zones;
create policy zones_update on public.zones for update using (public.is_member(household_id));
drop policy if exists zones_delete on public.zones;
create policy zones_delete on public.zones for delete using (public.is_member(household_id));

-- Realtime (idempotent, zoals in 0003/0004).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'zones'
  ) then
    alter publication supabase_realtime add table public.zones;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Koppel een task aan een zone. Zone verwijderen ontkoppelt de taak (laat 'm
--    staan), verwijdert de taak niet.
-- ---------------------------------------------------------------------------
alter table public.tasks add column if not exists zone_id uuid
  references public.zones(id) on delete set null;

create index if not exists tasks_zone_idx on public.tasks(zone_id) where zone_id is not null;
