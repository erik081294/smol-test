-- ============================================================================
-- HUISHOEK — 0078: account- & dataverwijdering (PLT-11, plan 29 S1)
-- ============================================================================
-- Google Play/App Store eisen in-app accountverwijdering; de AVG eist het wissen
-- van persoonsgegevens. Review-bevinding Data-1 (2026-07-02): het verwijderen van
-- een `auth.users`-rij LOOPT NU STUK — alleen migratie 0002 zette FK's op SET NULL;
-- vrijwel elke module daarna kreeg een creator/author-FK zonder delete-gedrag
-- (NO ACTION), plus 0070's rekey-guard blokkeert het SET-NULL-cascade-pad.
--
-- Besluit (2026-07-09, D7): ANONIMISEREN. Gedeelde huishoudrecords blijven bestaan
-- met een geanonimiseerde maker ("onbekend lid", created_by → NULL); persoonlijke
-- data cascadeert al met de profielrij (0002-cascade). Zo verdwijnt het
-- persoonsgegeven zonder dat het huishouden zijn geschiedenis kwijtraakt.
--
-- Deze migratie doet DRIE dingen; ze wordt BEWUST NIET blind live gezet — eerst
-- reviewen (zie de twee ⚠️-reviewpunten onderaan).
--   A. Rekey-guard (0070) versoepelen: creator-kolom MAG naar NULL (anonimisering),
--      maar nog steeds niet naar een ándere waarde (het Sec-1-dreigingsmodel:
--      misattributie/kaping blijft geblokkeerd; household_id blijft onveranderlijk).
--   B. De 22 NO ACTION-FK's naar `profiles` → SET NULL (anonimiseren), behalve
--      timeline_reactions → CASCADE (een reactie "van niemand" is zinloos en heeft
--      geen afhankelijke rijen; hij vertrekt met de eigenaar).
--   C. Twee DEFINER-RPC's: `account_deletion_preview()` (impact tonen vóór verwijderen)
--      en `delete_account()` (de eigenlijke verwijdering, met owner-blokkade).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Rekey-guard versoepelen: creator → NULL is toegestaan (anonimisering).
--    De 0070-guard verbood ELKE wijziging van de creator-kolom; het SET-NULL-
--    cascade-pad hieronder is óók een UPDATE en zou dus afketsen. We staan nu
--    expliciet de overgang "waarde → NULL" toe (attributie weghalen), maar
--    blokkeren nog steeds "waarde → andere waarde" (het oorspronkelijke doel:
--    een rij niet aan een ander lid kunnen toeschrijven). household_id blijft
--    volledig onveranderlijk.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_module_rekey()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  creator_col text := tg_argv[0];
  new_creator text := to_jsonb(new)->>creator_col;
  old_creator text := to_jsonb(old)->>creator_col;
begin
  if (to_jsonb(new)->>'household_id') is distinct from (to_jsonb(old)->>'household_id') then
    raise exception 'household_id is onveranderlijk' using errcode = 'check_violation';
  end if;
  -- Wél toegestaan: waarde → NULL (anonimisering bij account-verwijdering).
  -- Niet toegestaan: waarde → ándere niet-null waarde (misattributie).
  if new_creator is distinct from old_creator and new_creator is not null then
    raise exception '% mag alleen naar NULL (anonimisering), niet naar een andere waarde', creator_col
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_module_rekey() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- B. NO ACTION-FK's naar profiles → SET NULL (anonimiseren), reactions → CASCADE.
--    Per kolom: eerst NOT NULL laten vallen (waar nodig), dan de bestaande FK
--    opzoeken + vervangen door één met het gekozen delete-gedrag. Idempotent:
--    de FK wordt op naam opgezocht en opnieuw aangelegd met een vaste naam.
--    Al-SET-NULL-kolommen (tasks/groceries/plants/... uit 0002) staan hier NIET —
--    die hadden het delete-gedrag al; ze profiteren enkel van de guard-versoepeling.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  fk_name text;
begin
  for r in select * from (values
      -- Gedeelde huishoudrecords → anonimiseren (maker/betaler naar NULL).
      ('expenses',            'created_by', 'set null'),
      ('expenses',            'paid_by',    'set null'),  -- ⚠️ zie reviewpunt 1
      ('recurring_expenses',  'created_by', 'set null'),
      ('recurring_expenses',  'paid_by',    'set null'),  -- ⚠️ zie reviewpunt 1
      ('meal_plan_entries',   'created_by', 'set null'),
      ('pets',                'created_by', 'set null'),
      ('pet_log',             'created_by', 'set null'),
      ('plants',              'created_by', 'set null'),
      ('plant_photos',        'created_by', 'set null'),
      ('products',            'created_by', 'set null'),
      ('purchases',           'created_by', 'set null'),
      ('recipes',             'created_by', 'set null'),
      ('shared_resources',    'created_by', 'set null'),
      ('tags',                'created_by', 'set null'),
      ('vehicles',            'created_by', 'set null'),
      ('vehicle_log',         'created_by', 'set null'),
      -- Sociale content → anonimiseren i.p.v. cascaden: een post cascaden zou
      -- óók de reacties/comments van ándere leden meenemen (collateral damage).
      -- ⚠️ zie reviewpunt 2 (vrije tekst blijft bewaard, alleen de auteur wordt anoniem).
      ('timeline_posts',      'author_id',  'set null'),
      ('timeline_posts',      'pinned_by',  'set null'),
      ('timeline_comments',   'author_id',  'set null'),
      -- Uitnodigingen: al nullable, alleen delete-gedrag.
      ('household_invites',   'created_by', 'set null'),
      ('household_invites',   'accepted_by','set null'),
      -- Reactie = losse persoonlijke uiting zonder afhankelijke rijen → cascade.
      ('timeline_reactions',  'author_id',  'cascade')
    ) as v(tbl, col, act)
  loop
    if r.act = 'set null' then
      execute format('alter table public.%I alter column %I drop not null', r.tbl, r.col);
    end if;
    select con.conname into fk_name
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.conrelid = ('public.' || r.tbl)::regclass
      and con.confrelid = 'public.profiles'::regclass
      and a.attname = r.col;
    if fk_name is not null then
      execute format('alter table public.%I drop constraint %I', r.tbl, fk_name);
    end if;
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete %s',
      r.tbl, r.tbl || '_' || r.col || '_fkey', r.col, r.act
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- C1. Preview: welke huishoudens blokkeren / worden opgeruimd / verlaten?
--     Voedt lib/accountDeletion.js (client toont de impact vóór het verwijderen).
--     STABLE + DEFINER, gescoped op auth.uid() — leest alleen de eigen lidmaatschappen.
-- ---------------------------------------------------------------------------
create or replace function public.account_deletion_preview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'householdId', hm.household_id,
    'name',        h.name,
    'role',        hm.role,
    'memberCount', (select count(*) from public.household_members x where x.household_id = hm.household_id),
    'ownerCount',  (select count(*) from public.household_members x where x.household_id = hm.household_id and x.role = 'owner')
  )), '[]'::jsonb)
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.profile_id = auth.uid();
$$;

revoke all on function public.account_deletion_preview() from public, anon;
grant execute on function public.account_deletion_preview() to authenticated;

-- ---------------------------------------------------------------------------
-- C2. De verwijdering zelf. Eén transactie:
--     1. Blokkeer als de gebruiker de énige owner is van een huishouden met
--        andere leden (eerst beheer overdragen — spiegelt classifyHouseholds).
--     2. Ruim huishoudens op waarvan de gebruiker het énige lid is (cascade
--        verwijdert alle huishouddata — alle 39 household_id-FK's zijn CASCADE).
--     3. Verwijder de auth-user → cascadeert de profielrij → persoonlijke data
--        (prefs/tokens/assistent/lidmaatschappen) weg, gedeelde content anoniem.
--     DEFINER: de functie-eigenaar (postgres/supabase_admin) mag uit auth.users
--     verwijderen. ⚠️ verifieer op apply dat de owner die rechten heeft.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Niet ingelogd.' using errcode = '28000';
  end if;

  -- 1. Owner-blokkade: enige owner + andere leden aanwezig → weigeren.
  if exists (
    select 1 from public.household_members hm
    where hm.profile_id = uid and hm.role = 'owner'
      and (select count(*) from public.household_members o
           where o.household_id = hm.household_id and o.role = 'owner') = 1
      and (select count(*) from public.household_members m
           where m.household_id = hm.household_id and m.profile_id <> uid) > 0
  ) then
    raise exception 'Je bent de enige beheerder van een huishouden met andere leden. Draag eerst het beheer over.'
      using errcode = 'P0001';
  end if;

  -- 2. Solo-huishoudens volledig opruimen (cascade).
  delete from public.households h
  where h.id in (select hm.household_id from public.household_members hm where hm.profile_id = uid)
    and (select count(*) from public.household_members m where m.household_id = h.id) = 1;

  -- 3. Auth-user weg → profiel cascadeert → downstream SET NULL/CASCADE.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================================
-- ⚠️ REVIEWPUNTEN (vóór apply beslissen):
--
--  1. expenses.paid_by / recurring_expenses.paid_by → SET NULL betekent dat de
--     betalingen van een vertrokken lid ONGEATTRIBUEERD worden. De saldologica
--     (lib/expenses.js computeBalances / household_expense_totals) telt `paid_by`
--     per profiel; een null-betaler valt uit de saldo-attributie. Historisch
--     defensief (AVG: persoonslink weg), maar controleer of de saldo-weergave een
--     null-betaler netjes verdraagt (geen crash, gewoon "voormalig lid").
--
--  2. timeline_posts.body / timeline_comments.body blijven BEWAARD met een anonieme
--     auteur (forum-stijl "onbekend lid"). Is strikte content-verwijdering vereist,
--     zet deze twee dan op CASCADE — maar let op: een post cascaden neemt de
--     comments/reacties/foto's van ánderen mee. Comments los cascaden kan wél zonder
--     collateral.
--
--  3. delete_account() verwijdert uit auth.users via SECURITY DEFINER. Verifieer op
--     apply dat de functie-eigenaar delete-rechten op auth.users heeft (in Supabase
--     draait apply als een rol die dit mag; bevestig na de eerste apply met een
--     wegwerp-testaccount).
--
--  Verificatie na apply: (a) een wegwerp-lid dat solo-owner is + gedeelde content
--  heeft → delete_account() slaagt, content blijft met created_by NULL; (b) een
--  solo-owner-met-andere-leden → nette P0001-fout; (c) RLS-scenario in
--  tests/rls.integration.test.js (zie de toegevoegde cases).
-- ============================================================================
