-- ============================================================================
-- HUISHOEK — 0005: Agenda (weergavelaag over tasks)
-- ============================================================================
-- De agenda krijgt GEEN eigen tabel: afspraken bestaan al als tasks (category
-- 'afspraak') en elke taak met een due_date heeft een plek op de kalender. Deze
-- migratie voegt alleen het minimale toe dat de weergave nodig heeft:
--   - end_time: optionele eindtijd, zodat een afspraak een duur kan tonen.
--   - een index op (household_id, due_date) voor het laden van een maandvenster.
-- Subgroep-zichtbaarheid werkt automatisch: tasks valt al onder
-- enable_module_rls('tasks','created_by') uit 0003.
-- ============================================================================

alter table public.tasks add column if not exists end_time time;

create index if not exists tasks_due_date_idx
  on public.tasks(household_id, due_date)
  where due_date is not null;
