-- ============================================================================
-- HUISHOEK — 0047: Onderhoudshistorie per voertuig (VTG-2)
-- ============================================================================
-- vehicle_log: een tijdlijn van uitgevoerd onderhoud per voertuig (datum, wat,
-- km-stand, kosten, notitie). Geen eigen visibility-kolommen — erft de zichtbaarheid
-- van het parent-voertuig (zoals pet_log ↔ pets in 0038, plant_photos ↔ plants in 0011).
-- `expense_id` koppelt optioneel naar een WieBetaaltWat-uitgave (create_expense), zodat
-- gerealiseerde kosten in de saldo's meelopen; null = puur in de auto-begroting.
-- ============================================================================

create table if not exists public.vehicle_log (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  vehicle_id   uuid not null references public.vehicles(id) on delete cascade,
  title        text,
  performed_on date not null default current_date,
  mileage      int check (mileage is null or mileage >= 0),
  cost_cents   int check (cost_cents is null or cost_cents >= 0),
  note         text,
  expense_id   uuid references public.expenses(id) on delete set null,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists vehicle_log_vehicle_idx on public.vehicle_log(vehicle_id, performed_on desc);

alter table public.vehicle_log enable row level security;

-- Zien: wie het parent-voertuig mag zien (can_view), mag ook de historie zien.
drop policy if exists vehicle_log_select on public.vehicle_log;
create policy vehicle_log_select on public.vehicle_log for select using (
  exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id
      and public.can_view(v.household_id, v.visibility, v.share_subgroup_id, v.share_with, v.created_by)
  )
);

-- Schrijven: lid van het huishouden van het parent-voertuig.
drop policy if exists vehicle_log_write on public.vehicle_log;
create policy vehicle_log_write on public.vehicle_log for all using (
  exists (select 1 from public.vehicles v where v.id = vehicle_id and public.is_member(v.household_id))
) with check (
  exists (select 1 from public.vehicles v where v.id = vehicle_id and public.is_member(v.household_id))
);

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vehicle_log'
  ) then
    alter publication supabase_realtime add table public.vehicle_log;
  end if;
end $$;
