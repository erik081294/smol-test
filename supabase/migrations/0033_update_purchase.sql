-- ============================================================================
-- HUISHOEK — 0033: bon (purchase) bewerkbaar maken (BOO-10)
-- ============================================================================
-- Tot nu toe was een opgeslagen bon alleen-lezen, terwijl uitgaven al bewerkbaar zijn
-- (update_expense, 0025). Deze RPC spiegelt dat patroon: werk de bon-kop bij en vervang
-- de regels atomair (delete + herinsert), net als update_expense met zijn shares. De
-- foto (photo_path) en created_by blijven ongemoeid.
-- ============================================================================
create or replace function public.update_purchase(
  p_id uuid, p_household_id uuid, p_store text, p_purchased_on date,
  p_total_cents int, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  update public.purchases set
    store        = p_store,
    purchased_on = coalesce(p_purchased_on, current_date),
    total_cents  = p_total_cents
  where id = p_id and household_id = p_household_id;

  if not found then
    raise exception 'bon % niet gevonden in huishouden %', p_id, p_household_id
      using errcode = 'no_data_found';
  end if;

  delete from public.purchase_items where purchase_id = p_id;

  insert into public.purchase_items
    (household_id, purchase_id, product_id, name, quantity, unit, unit_price_cents, line_total_cents)
  select p_household_id, p_id, nullif(i->>'product_id','')::uuid, i->>'name',
         coalesce((i->>'quantity')::numeric, 1), coalesce(i->>'unit', 'stuk'),
         (i->>'unit_price_cents')::int, (i->>'line_total_cents')::int
  from jsonb_array_elements(p_items) as i;

  return p_id;
end;
$$;

grant execute on function public.update_purchase(uuid, uuid, text, date, int, jsonb) to authenticated;
