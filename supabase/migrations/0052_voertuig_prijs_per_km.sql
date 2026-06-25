-- ============================================================================
-- HUISHOEK — 0052: Delen met kosten — prijs per km (V4)
-- ============================================================================
-- De eigenaar kan een tarief per km zetten op de auto. Bij een reservering met een
-- km-stand (reservations.usage_value) maakt de app daar automatisch een uitgave van
-- (de rijder betaalt de eigenaar). "Gratis" = geen tarief (null): reserveren mag dan
-- zonder kosten (bv. kinderen).
--
-- Het tarief leeft op het voertuig (de eigenaar beheert het daar, ook als de auto even
-- niet gedeeld is) én op de gekoppelde shared_resources-rij (die de reservering kent).
-- set_vehicle_shared synct het tarief mee, net als naam/zichtbaarheid.
-- ============================================================================

alter table public.vehicles add column if not exists price_per_km_cents int
  check (price_per_km_cents is null or price_per_km_cents >= 0);
alter table public.shared_resources add column if not exists price_per_km_cents int
  check (price_per_km_cents is null or price_per_km_cents >= 0);

-- RPC bijwerken: synct nu ook price_per_km_cents (insert + de "al gedeeld"-update).
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
        (household_id, name, kind, visibility, share_subgroup_id, share_with, created_by, price_per_km_cents)
      values
        (v.household_id, v.name, 'auto', v.visibility, v.share_subgroup_id, v.share_with, v.created_by, v.price_per_km_cents)
      returning id into rid;
      update public.vehicles set resource_id = rid where id = v.id;
    else
      update public.shared_resources
        set name = v.name, visibility = v.visibility,
            share_subgroup_id = v.share_subgroup_id, share_with = v.share_with,
            price_per_km_cents = v.price_per_km_cents
        where id = v.resource_id;
      rid := v.resource_id;
    end if;
    return rid;
  end if;

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

revoke execute on function public.set_vehicle_shared(uuid, boolean) from public, anon;
grant execute on function public.set_vehicle_shared(uuid, boolean) to authenticated;
