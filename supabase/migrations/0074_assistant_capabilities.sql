-- ============================================================================
-- HUISHOEK — 0074: AI-capabilities per lid (fundament AI-actie-laag, B4)
-- ============================================================================
-- Een aparte autorisatielaag náást RLS (rij-toegang) en de module-toggle (of een
-- module meedoet): WELKE AI-acties mag de assistent namens een specifiek lid
-- uitvoeren. Use-case: parental control — "kinderen mogen de assistent geen
-- uitgaven laten boeken". De policy leeft puur in lib/aiCapabilities.js; deze tabel
-- houdt alleen de intrekkingen bij.
--
-- DEFAULT-ON, net als de module-toggles (0004): een capability geldt tenzij er een
-- rij met allowed=false staat. Zo hoeft niets geseed te worden — wie niets instelt
-- houdt alle capabilities. De owner beheert per lid; leden lezen hun eigen stand.
--
-- capability_key is open tekst (zoals module_key in 0004) — de app is de bron van
-- de vocabulaire (AI_CAPABILITIES: ai:write / ai:spend / ai:destructive). Zo hoeft
-- een nieuwe capability geen migratie.
-- ============================================================================

create table if not exists public.user_ai_capabilities (
  household_id   uuid not null references public.households(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  capability_key text not null,
  allowed        boolean not null default true,
  updated_at     timestamptz not null default now(),
  primary key (household_id, profile_id, capability_key)
);

-- ---------------------------------------------------------------------------
-- RLS: de owner van het huishouden beheert de AI-capabilities van elk lid; een
-- lid mag uitsluitend zijn eigen stand INZIEN (niet zelf wijzigen — dat is
-- bewust: parental control mag een lid niet kunnen terugdraaien). is_owner /
-- is_member komen uit 0001/0004.
-- ---------------------------------------------------------------------------
alter table public.user_ai_capabilities enable row level security;

drop policy if exists "user_ai_capabilities_select" on public.user_ai_capabilities;
create policy "user_ai_capabilities_select" on public.user_ai_capabilities for select
  using (public.is_owner(household_id) or (select auth.uid()) = profile_id);

drop policy if exists "user_ai_capabilities_write" on public.user_ai_capabilities;
create policy "user_ai_capabilities_write" on public.user_ai_capabilities for all
  using (public.is_owner(household_id))
  with check (
    public.is_owner(household_id)
    -- en het doel-profiel is echt lid van dit huishouden (geen capabilities voor buitenstaanders)
    and exists (
      select 1 from public.household_members m
      where m.household_id = user_ai_capabilities.household_id
        and m.profile_id = user_ai_capabilities.profile_id
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (idempotent, zoals in 0003/0004) — de beheer-UI reageert live.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'user_ai_capabilities'
  ) then
    alter publication supabase_realtime add table public.user_ai_capabilities;
  end if;
end $$;
