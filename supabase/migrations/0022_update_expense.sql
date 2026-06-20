-- ============================================================================
-- HUISHOEK — 0022: Uitgave bijwerken (update_expense RPC)
-- ============================================================================
-- Tot nu toe waren uitgaven onbewerkbaar: een typefout corrigeren betekende
-- verwijderen + opnieuw aanmaken. Deze RPC werkt de uitgave + haar aandelen
-- atomair bij, als spiegel van create_expense (0019). De bron-koppeling
-- (source_type/source_id) blijft bewust ongemoeid — die hoort bij het ontstaan
-- van de uitgave, niet bij een latere correctie.
-- Idempotent (create or replace).
-- ============================================================================

create or replace function public.update_expense(
  p_id                uuid,
  p_household_id      uuid,
  p_description       text,
  p_amount_cents      int,
  p_paid_by           uuid,
  p_spent_on          date,
  p_split_type        text,
  p_visibility        text,
  p_share_subgroup_id uuid,
  p_share_with        uuid[],
  p_shares            jsonb,
  p_category          text default 'overig'
) returns uuid
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  update public.expenses set
    description       = p_description,
    amount_cents      = p_amount_cents,
    paid_by           = p_paid_by,
    spent_on          = coalesce(p_spent_on, current_date),
    split_type        = p_split_type,
    visibility        = coalesce(p_visibility, 'household'),
    share_subgroup_id = case when p_visibility = 'subgroup' then p_share_subgroup_id else null end,
    share_with        = case when p_visibility = 'custom' then p_share_with else null end,
    category          = coalesce(p_category, 'overig')
  where id = p_id and household_id = p_household_id;

  if not found then
    raise exception 'uitgave % niet gevonden in huishouden %', p_id, p_household_id
      using errcode = 'no_data_found';
  end if;

  -- Aandelen volledig vervangen (delete + re-insert) binnen dezelfde transactie.
  delete from public.expense_shares where expense_id = p_id;

  insert into public.expense_shares (expense_id, profile_id, amount_cents)
  select p_id, (s->>'profile_id')::uuid, (s->>'amount_cents')::int
  from jsonb_array_elements(p_shares) as s;

  return p_id;
end;
$$;
