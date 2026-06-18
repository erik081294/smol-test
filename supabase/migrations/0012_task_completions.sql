-- ============================================================================
-- HUISHOEK — 0012: Voltooiingen-log + beurtrotatie (SCH-3, KLU-4)
-- ============================================================================
-- Een terugkerende taak rolt bij afvinken door en WIST completed_at/completed_by
-- (lib/useTasks.js). Daardoor mist 'tasks' een duurzame historie van wie wat deed
-- — precies wat een eerlijkheidsoverzicht (SCH-3) nodig heeft. Deze migratie voegt
-- een voltooiingen-log toe (één rij per afvink-actie, ook voor doorrollers).
--
-- task_completions heeft geen eigen visibility-kolommen: het erft de zichtbaarheid
-- van zijn parent-taak (zelfde patroon als plant_photos ↔ plants in 0011 en
-- expense_shares ↔ expenses in 0007).
--
-- Daarnaast: kolom tasks.rotation (beurtrotatie, KLU-4). Een array van profiel-ids
-- dat de volgorde bepaalt; null = geen rotatie. Bij het doorrollen van een
-- terugkerende rotatie-taak springt assigned_to naar de volgende in de lijst.
-- ============================================================================

create table if not exists public.task_completions (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  task_id         uuid not null references public.tasks(id) on delete cascade,
  completed_by    uuid references public.profiles(id) on delete set null,
  occurrence_date date,                 -- de due_date die werd afgevinkt (kan null zijn)
  completed_at    timestamptz not null default now()
);
create index if not exists task_completions_hh_idx on public.task_completions(household_id, completed_at desc);
create index if not exists task_completions_by_idx on public.task_completions(household_id, completed_by);
create index if not exists task_completions_task_idx on public.task_completions(task_id);

alter table public.task_completions enable row level security;

-- Zien: wie de parent-taak mag zien (erft can_view).
drop policy if exists task_completions_select on public.task_completions;
create policy task_completions_select on public.task_completions for select using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and public.can_view(t.household_id, t.visibility, t.share_subgroup_id, t.share_with, t.created_by)
  )
);

-- Schrijven: lid van het huishouden van de parent-taak.
drop policy if exists task_completions_write on public.task_completions;
create policy task_completions_write on public.task_completions for all using (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_member(t.household_id))
) with check (
  exists (select 1 from public.tasks t where t.id = task_id and public.is_member(t.household_id))
);

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_completions'
  ) then
    alter publication supabase_realtime add table public.task_completions;
  end if;
end $$;

-- Beurtrotatie (KLU-4): volgorde van profielen; null = geen rotatie.
alter table public.tasks add column if not exists rotation uuid[];
