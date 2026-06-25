-- ============================================================================
-- HUISHOEK — 0048: Voertuig delen via de Samen/Delen-module (VTG-4)
-- ============================================================================
-- Een voertuig kan tegelijk een gedeelde resource zijn (shared_resources kind 'auto'):
-- reserveren + kosten-naar-gebruik, bovenop het onderhoud. Voor auto's is dit de default.
--
-- Robuust (zie backlog §2): de koppeling is 1-op-1 en idempotent — vehicles.resource_id
-- verwijst naar de shared_resources-rij; een unieke (partiële) index borgt dat geen twee
-- voertuigen dezelfde resource delen. De RPC set_vehicle_shared maakt/synct of ontkoppelt
-- de resource in één transactie, erft de zichtbaarheid van het voertuig, en weigert
-- ontkoppelen zolang er actieve reserveringen zijn. Een delete-trigger ruimt de resource
-- mee op (geen wees-resources).
-- ============================================================================

alter table public.vehicles add column if not exists resource_id uuid
  references public.shared_resources(id) on delete set null;

-- 1-op-1: een gedeelde resource hoort bij hooguit één voertuig.
create unique index if not exists vehicles_resource_id_key
  on public.vehicles(resource_id) where resource_id is not null;

-- Idempotente share-toggle. p_shared=true: maak (of sync) de gekoppelde resource;
-- false: ontkoppel + verwijder de resource (mits geen actieve reserveringen).
create or replace function public.set_vehicle_shared(p_vehicle_id uuid, p_shared boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.vehicles;
  rid uuid;
  active_count int;
begin
  select * into v from public.vehicles where id = p_vehicle_id;
  if not found then
    raise exception 'voertuig % bestaat niet', p_vehicle_id using errcode = 'no_data_found';
  end if;
  if not public.is_member(v.household_id) then
    raise exception 'geen lid van huishouden %', v.household_id using errcode = 'check_violation';
  end if;

  if p_shared then
    if v.resource_id is null then
      insert into public.shared_resources
        (household_id, name, kind, visibility, share_subgroup_id, share_with, created_by)
      values
        (v.household_id, v.name, 'auto', v.visibility, v.share_subgroup_id, v.share_with, v.created_by)
      returning id into rid;
      update public.vehicles set resource_id = rid where id = v.id;
    else
      -- Al gedeeld: houd naam + zichtbaarheid in sync (idempotent, nooit een duplicaat).
      update public.shared_resources
        set name = v.name, visibility = v.visibility,
            share_subgroup_id = v.share_subgroup_id, share_with = v.share_with
        where id = v.resource_id;
      rid := v.resource_id;
    end if;
    return rid;
  end if;

  -- Ontkoppelen: weiger bij actieve reserveringen, anders resource weg + ontkoppelen.
  if v.resource_id is not null then
    select count(*) into active_count
      from public.reservations where resource_id = v.resource_id and ends_at > now();
    if active_count > 0 then
      raise exception 'voertuig heeft nog % actieve reservering(en)', active_count
        using errcode = 'check_violation';
    end if;
    update public.vehicles set resource_id = null where id = v.id;
    delete from public.shared_resources where id = v.resource_id;
  end if;
  return null;
end;
$$;

-- DEFINER-RPC: alleen voor ingelogde gebruikers (SEC-hardening, vgl. 0042–0044).
revoke execute on function public.set_vehicle_shared(uuid, boolean) from public, anon;
grant execute on function public.set_vehicle_shared(uuid, boolean) to authenticated;

-- Geen wees-resources: een voertuig verwijderen ruimt de gekoppelde resource mee op
-- (cascade verwijdert ook diens reserveringen). Moet een AFTER-trigger zijn: de
-- vehicles.resource_id-FK is ON DELETE SET NULL, dus de resource verwijderen in een
-- BEFORE-trigger zou de net-te-verwijderen voertuigrij willen updaten ("tuple already
-- modified"). AFTER DELETE: de voertuigrij is al weg, dus de SET NULL is een no-op.
create or replace function public.cleanup_vehicle_resource()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.resource_id is not null then
    delete from public.shared_resources where id = old.resource_id;
  end if;
  return old;
end;
$$;

drop trigger if exists vehicles_cleanup_resource on public.vehicles;
create trigger vehicles_cleanup_resource after delete on public.vehicles
  for each row execute function public.cleanup_vehicle_resource();
