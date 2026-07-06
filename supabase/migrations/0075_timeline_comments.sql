-- ============================================================================
-- HUISHOEK — 0075: Tijdlijn — tekstreacties / comments (TML-4, plan 19)
-- ============================================================================
-- Geschreven reacties kunnen alléén op handgeschreven berichten (timeline_posts);
-- systeem-events krijgen géén comment-thread (die krijgen alleen emoji-reacties,
-- 0067). Daarom is dit een gewone kind-tabel met een harde FK naar de post — geen
-- polymorf doelwit zoals timeline_reactions.
--
-- timeline_comments erft de zichtbaarheid van de parent-post, exact het patroon
-- van timeline_photos (0054): geen eigen visibility-kolommen, SELECT via can_view
-- op de parent. Net als daar draagt de rij wél een household_id, puur zodat de
-- realtime-subscriptie gescopet kan worden (geen brede tabel-subscription).
--
-- RLS-keuzes (plan 19 §TML-4):
--   • SELECT → can_view op de parent-post, mét household-match zodat een verkeerd
--     gelabelde rij (household_id ≠ post-huishouden) nergens meetelt (vgl. 0067).
--   • INSERT → is_member + author_id = auth.uid() (auteur niet te vervalsen), en
--     dezelfde can_view-check: je kunt niet reageren op een post die je niet mag
--     zien — en een comment lekt zo ook niet dat zo'n post bestaat.
--   • DELETE → alleen je eigen comment (author_id = auth.uid()). Geen UPDATE-
--     policy: comments zijn niet bewerkbaar (verwijderen + opnieuw plaatsen).
-- `(select auth.uid())` i.p.v. kale auth.uid(): initplan i.p.v. per-rij-call
-- (RLS-performance-advisor, vgl. 0072).
-- ============================================================================

create table if not exists public.timeline_comments (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.timeline_posts(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  author_id    uuid not null references public.profiles(id),
  body         text not null check (length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);

alter table public.timeline_comments enable row level security;

-- Thread-index: de comments van één post in chronologische volgorde (oudste eerst),
-- exact hoe orderComments (lib/timeline.js) en het detail-scherm ze tonen.
create index if not exists timeline_comments_post_idx
  on public.timeline_comments (post_id, created_at);

-- Zien: wie de parent-post mag zien (can_view), ziet ook de comments.
drop policy if exists timeline_comments_select on public.timeline_comments;
create policy timeline_comments_select on public.timeline_comments for select using (
  exists (
    select 1 from public.timeline_posts p
    where p.id = post_id
      and p.household_id = timeline_comments.household_id
      and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id)
  )
);

-- Plaatsen: lid van het huishouden, alleen op eigen naam, en alleen op een post
-- die je zelf mag zien (zelfde niet-lekken-regel als select).
drop policy if exists timeline_comments_insert on public.timeline_comments;
create policy timeline_comments_insert on public.timeline_comments for insert with check (
  public.is_member(household_id)
  and author_id = (select auth.uid())
  and exists (
    select 1 from public.timeline_posts p
    where p.id = post_id
      and p.household_id = timeline_comments.household_id
      and public.can_view(p.household_id, p.visibility, p.share_subgroup_id, p.share_with, p.author_id)
  )
);

-- Verwijderen: alleen je eigen comment.
drop policy if exists timeline_comments_delete on public.timeline_comments;
create policy timeline_comments_delete on public.timeline_comments for delete using (
  author_id = (select auth.uid())
);

-- Een verwijderde comment is een DELETE; bij de standaard replica identity draagt
-- dat event alleen de PK en matcht het household_id-filter van de subscriptie niet
-- (vgl. 0032/0067). FULL zet de hele oude rij in de WAL.
alter table public.timeline_comments replica identity full;

-- Realtime (idempotent, zoals elders).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timeline_comments'
  ) then
    alter publication supabase_realtime add table public.timeline_comments;
  end if;
end $$;
