-- PERF-8: server-side aggregatie voor de koopfrequentie. useProductFrequencies trok alle
-- bonregels (12 mnd) client-side op en groepeerde daar; deze RPC groepeert in de DB en geeft
-- één rij per product met z'n aankoopdatums terug (compacter payload, benut de index uit 0045).
-- SECURITY INVOKER → de bestaande RLS op purchase_items/purchases scopet mee; de expliciete
-- household-filter houdt de set bij het actieve huishouden (RLS dwingt lidmaatschap af).
--
-- NB: `supabase db push` is kapot; live aangebracht via MCP apply_migration (2026-06-27) en
-- geverifieerd (RPC geeft rijen terug). Dit bestand is de repo-spiegel.
create or replace function public.product_purchase_dates(p_household uuid, p_months int default 12)
returns table(product_id uuid, dates date[])
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select pi.product_id, array_agg(p.purchased_on order by p.purchased_on)
  from public.purchase_items pi
  join public.purchases p on p.id = pi.purchase_id
  where pi.household_id = p_household
    and pi.product_id is not null
    and p.purchased_on >= (current_date - make_interval(months => greatest(coalesce(p_months, 12), 1)))
  group by pi.product_id;
$function$;

revoke all on function public.product_purchase_dates(uuid, int) from public, anon;
grant execute on function public.product_purchase_dates(uuid, int) to authenticated;
