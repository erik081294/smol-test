-- ============================================================================
-- HUISHOEK — 0067: Tijdlijn — emoji-reacties (TML-3, plan 19)
-- ============================================================================
-- Eén rij per (doel, lid, emoji); togglen = insert/delete op de unique-
-- constraint. Polymorf doelwit:
--   • target_type='post'  → target_id = timeline_posts.id (als tekst)
--   • target_type='event' → target_id = '<bron_tabel>:<bron_id>' — het stabiele
--     reactionTarget dat lib/useActivity.js aan elk systeem-event hangt (bv.
--     'task_completions:<uuid>'). Bewust de échte tabelnaam, niet de korte
--     feed-id-prefix ('t:'/'e:'): die prefixen zijn UI-intern en mogen wijzigen.
--
-- RLS-keuzes (plan 19 §TML-3):
--   • basis read/write = is_member(household_id); write bovendien alleen je
--     eigen rij (author_id = auth.uid()).
--   • target_type='post' → extra can_view op de parent-post, zodat een reactie
--     niet lekt dat een niet-zichtbare (subgroep/custom) post bestaat — en je
--     ook niet kúnt reageren op een post die je niet mag zien.
--   • target_type='event' → de huishouden-scope is de guard: het event zelf
--     verschijnt alleen in de feed van wie het via de bron-RLS mag zien.
--     (Hardening — ook de bron-zichtbaarheid joinen — bewust uitgesteld.)
-- `(select auth.uid())` i.p.v. kale auth.uid(): initplan i.p.v. per-rij-call
-- (RLS-performance-advisor).
-- ============================================================================

create table if not exists public.timeline_reactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  author_id    uuid not null references public.profiles(id),
  target_type  text not null check (target_type in ('post','event')),
  target_id    text not null,        -- post: timeline_posts.id ; event: '<bron_tabel>:<bron_id>'
  emoji        text not null,
  created_at   timestamptz not null default now(),
  unique (target_type, target_id, author_id, emoji)
);

alter table public.timeline_reactions enable row level security;

-- Lookup-index voor de household-brede laad (één query per huishouden, daarna
-- per doel aggregeren in de app); de unique-constraint dekt de toggle-lookup al.
create index if not exists timeline_reactions_household_idx
  on public.timeline_reactions (household_id, target_type, target_id);

-- Zien: huisgenoten; post-reacties alleen als je de parent-post mag zien.
-- De household-match op de parent voorkomt dat een verkeerd gelabelde rij
-- (household_id ≠ post-huishouden) alsnog ergens meetelt.
drop policy if exists timeline_reactions_select on public.timeline_reactions;
create policy timeline_reactions_select on public.timeline_reactions for select using (
  public.is_member(household_id)
  and (
    target_type <> 'post'
    or exists (
      select 1 from public.timeline_posts p
      where p.id::text = target_id
        and p.household_id = timeline_reactions.household_id
        and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id)
    )
  )
);

-- Schrijven: alleen je eigen reactie, binnen je eigen huishouden; op een post
-- alleen als je die post mag zien (zelfde niet-lekken-regel als select).
drop policy if exists timeline_reactions_write on public.timeline_reactions;
create policy timeline_reactions_write on public.timeline_reactions for all using (
  public.is_member(household_id)
  and author_id = (select auth.uid())
  and (
    target_type <> 'post'
    or exists (
      select 1 from public.timeline_posts p
      where p.id::text = target_id
        and p.household_id = timeline_reactions.household_id
        and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id)
    )
  )
) with check (
  public.is_member(household_id)
  and author_id = (select auth.uid())
  and (
    target_type <> 'post'
    or exists (
      select 1 from public.timeline_posts p
      where p.id::text = target_id
        and p.household_id = timeline_reactions.household_id
        and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id)
    )
  )
);

-- Toggle-uit is een DELETE; bij de standaard replica identity draagt dat event
-- alleen de PK en matcht het household_id-filter van de subscriptie niet (vgl.
-- 0032 voor expense_shares/purchase_items). FULL zet de hele oude rij in de WAL.
alter table public.timeline_reactions replica identity full;

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timeline_reactions'
  ) then
    alter publication supabase_realtime add table public.timeline_reactions;
  end if;
end $$;
