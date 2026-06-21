-- ============================================================================
-- HUISHOEK — 0029: gebruiksteller op products voor "Vaste boodschappen" (BOO-…)
-- ============================================================================
-- "Vaste boodschappen" leunt op je geschiedenis: de producten die je huishouden vaak
-- toevoegt, gecategoriseerd en op gebruik gesorteerd, om met één tik opnieuw op de lijst
-- te zetten. Daarvoor onthouden we per product HOE VAAK en WANNEER het laatst aan de
-- boodschappenlijst is toegevoegd.
--
-- `times_added` + `last_added_at` worden automatisch bijgewerkt door een trigger op
-- groceries-inserts (met een product_id), zodat de teller niet kan afdrijven en de
-- app-code er niets voor hoeft te doen. We backfillen uit de bestaande historie.
-- ============================================================================

alter table public.products add column if not exists times_added   int         not null default 0;
alter table public.products add column if not exists last_added_at timestamptz;

-- Backfill uit de bestaande boodschappen (incl. afgevinkte): tel per product en pak de
-- meest recente toevoeging.
update public.products p set
  times_added   = sub.cnt,
  last_added_at = sub.last
from (
  select product_id, count(*) as cnt, max(created_at) as last
  from public.groceries
  where product_id is not null
  group by product_id
) sub
where p.id = sub.product_id;

-- Trigger: elke boodschap mét product_id hoogt de teller op en verschuift de recency.
-- SECURITY DEFINER zodat het ophogen niet afhangt van de RLS-schrijfrechten van de
-- toevoegende gebruiker.
create or replace function public.bump_product_usage()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.products
     set times_added   = times_added + 1,
         last_added_at = now()
   where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists groceries_bump_product on public.groceries;
create trigger groceries_bump_product
  after insert on public.groceries
  for each row
  when (new.product_id is not null)
  execute function public.bump_product_usage();
