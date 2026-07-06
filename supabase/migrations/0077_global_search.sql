-- ============================================================================
-- HUISHOEK — 0077: PLT-3 — globaal zoeken over de modules heen (RPC)
-- ============================================================================
-- Eén zoek-RPC voor het zoekscherm (app/zoeken.js): zoekt in de acht
-- doorzoekbare module-tabellen en geeft een platte, uniforme hitlijst terug
-- (kind/id/title/subtitle/happened_on). De client rangschikt verder
-- (lib/searchRank.js: exact > prefix > woordgrens > substring) en groepeert
-- per module — de server houdt het bij goedkoop voorfilteren.
--
-- SECURITY INVOKER (essentieel, zelfde redenering als 0037): de bestaande RLS
-- op elke tabel filtert dan automatisch precies de rijen die de aanroeper mag
-- zien — inclusief het zichtbaarheidscontract (household/subgroup/custom via
-- can_view). Een niet-lid dat een vreemd household-id raadt krijgt dus gewoon
-- nul rijen; p_household is alleen de scope-versmalling, geen security-grens.
-- `set search_path = public` volgt de B4-hardening uit 0024.
--
-- LIKE-wildcards in de zoekterm worden geëscaped (\ eerst, dan % en _), zodat
-- "100%" letterlijk zoekt en een gebruiker geen patroon kan injecteren.
-- Per bron max 10 hits (elke arm heeft z'n eigen order by zodat de afkap de
-- meest relevante rijen houdt); totaal gemaxt op 80.
-- ============================================================================

create or replace function public.global_search(p_household uuid, p_query text)
returns table (kind text, id uuid, title text, subtitle text, happened_on date)
language sql
security invoker
stable
set search_path = public
as $$
  with invoer as (
    -- Eén keer trimmen + escapen; elke arm leest hieruit. Lege term → geen
    -- enkele arm matcht (anders zou '%%' de hele tabel teruggeven).
    select
      trim(coalesce(p_query, '')) as term,
      '%' || replace(replace(replace(trim(coalesce(p_query, '')),
        '\', '\\'), '%', '\%'), '_', '\_') || '%' as patroon
  )
  select * from (
    -- Taken: open taken eerst (die zoek je doorgaans), daarna op planning.
    (select 'task'::text, tk.id, tk.title, tk.notes, tk.due_date
       from public.tasks tk, invoer q
      where q.term <> '' and tk.household_id = p_household and tk.title ilike q.patroon
      order by (tk.completed_at is null) desc, tk.due_date desc nulls last, tk.created_at desc
      limit 10)
    union all
    -- Boodschappen (lijst-items).
    (select 'grocery'::text, g.id, g.name, g.quantity, g.created_at::date
       from public.groceries g, invoer q
      where q.term <> '' and g.household_id = p_household and g.name ilike q.patroon
      order by g.created_at desc
      limit 10)
    union all
    -- Recepten.
    (select 'recipe'::text, r.id, r.title, null::text, r.created_at::date
       from public.recipes r, invoer q
      where q.term <> '' and r.household_id = p_household and r.title ilike q.patroon
      order by r.created_at desc
      limit 10)
    union all
    -- Uitgaven: bedrag als subtitle ("€12,50" — zelfde vorm als lib/expenses
    -- formatCents), gedateerd op de uitgavedatum.
    (select 'expense'::text, e.id, e.description,
            '€' || replace(to_char(e.amount_cents / 100.0, 'FM999999990.00'), '.', ','),
            e.spent_on
       from public.expenses e, invoer q
      where q.term <> '' and e.household_id = p_household and e.description ilike q.patroon
      order by e.spent_on desc
      limit 10)
    union all
    -- Planten.
    (select 'plant'::text, pl.id, pl.name, pl.location, pl.created_at::date
       from public.plants pl, invoer q
      where q.term <> '' and pl.household_id = p_household and pl.name ilike q.patroon
      order by pl.created_at desc
      limit 10)
    union all
    -- Huisdieren.
    (select 'pet'::text, pe.id, pe.name, nullif(pe.type, ''), pe.created_at::date
       from public.pets pe, invoer q
      where q.term <> '' and pe.household_id = p_household and pe.name ilike q.patroon
      order by pe.created_at desc
      limit 10)
    union all
    -- Voertuigen: naam óf kenteken matcht; merk/model (of het kenteken) als context.
    (select 'vehicle'::text, v.id, v.name,
            coalesce(nullif(trim(concat_ws(' ', v.make, v.model)), ''), v.license_plate),
            v.created_at::date
       from public.vehicles v, invoer q
      where q.term <> '' and v.household_id = p_household
        and (v.name ilike q.patroon or v.license_plate ilike q.patroon)
      order by v.created_at desc
      limit 10)
    union all
    -- Tijdlijn: berichttekst; een fragment als titel (witruimte platgeslagen).
    (select 'timeline'::text, tp.id,
            left(regexp_replace(tp.body, '\s+', ' ', 'g'), 80),
            null::text, tp.created_at::date
       from public.timeline_posts tp, invoer q
      where q.term <> '' and tp.household_id = p_household
        and tp.body is not null and tp.body ilike q.patroon
      order by tp.created_at desc
      limit 10)
  ) hits (kind, id, title, subtitle, happened_on)
  limit 80;
$$;

-- EXECUTE-oppervlak strak (patroon 0042/0043/0058): PUBLIC/anon eruit — de
-- functie is INVOKER en zou voor anon toch niets teruggeven (geen tabel-
-- privileges), maar het anon-oppervlak hoort dicht. Alleen ingelogde
-- app-gebruikers zoeken.
revoke execute on function public.global_search(uuid, text) from public, anon;
grant execute on function public.global_search(uuid, text) to authenticated;
