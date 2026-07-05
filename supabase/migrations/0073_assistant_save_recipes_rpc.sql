-- 0073 — Atomair recept opslaan voor de assistent (AI-12-hardening).
--
-- Aanleiding: maaltijden_recept_opslaan.execute voegde per recept in een losse
-- lus een `recipes`-rij en daarna zijn `recipe_ingredients` in. Brak een insert
-- halverwege (bv. het tweede recept), dan bleven de al-ingevoegde recepten als
-- weesrijen achter — en omdat de edge de aangemaakte ids pas bij volledig succes
-- persisteert, waren die weesrijen niet undo-baar. Alle andere assistent-writes
-- (taken/boodschappen/maaltijden_plannen) doen één atomaire insert; recept-
-- opslaan was de uitzondering.
--
-- Deze DEFINER-RPC zet recept + ingrediënten voor álle voorgestelde recepten in
-- één transactie weg (een plpgsql-functie rolt bij een exception volledig terug)
-- en geeft de aangemaakte recipe-ids in volgorde terug, zodat de edge ze als
-- undo-spoor kan bewaren. Autorisatie via de expliciete is_member-poort (zelfde
-- patroon als add_groceries/create_purchase); de args zijn al door de pure
-- propose() genormaliseerd, de coalesces zijn defensief.

create or replace function public.save_recipes(p_household_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_item      jsonb;
  v_ing       jsonb;
  v_recipe_id uuid;
  v_ids       uuid[] := '{}';
  v_sort      int;
begin
  if not public.is_member(p_household_id) then
    raise exception 'geen lid van huishouden %', p_household_id using errcode = 'check_violation';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.recipes (household_id, created_by, title, servings, instructions)
    values (
      p_household_id,
      v_uid,
      v_item->>'title',
      coalesce(nullif(v_item->>'servings','')::int, 2),
      nullif(v_item->>'instructions', '')
    )
    returning id into v_recipe_id;
    v_ids := array_append(v_ids, v_recipe_id);

    v_sort := 0;
    for v_ing in select * from jsonb_array_elements(coalesce(v_item->'ingredients', '[]'::jsonb)) loop
      insert into public.recipe_ingredients (household_id, recipe_id, name, quantity, unit, sort_order)
      values (
        p_household_id,
        v_recipe_id,
        v_ing->>'name',
        coalesce(nullif(v_ing->>'quantity','')::numeric, 1),
        coalesce(nullif(v_ing->>'unit',''), 'stuk'),
        v_sort
      );
      v_sort := v_sort + 1;
    end loop;
  end loop;

  return to_jsonb(v_ids);
end $$;

-- Alleen ingelogde gebruikers; de is_member-poort scopet naar het eigen
-- huishouden (conform 0042-0044/0058: geen anon/PUBLIC-EXECUTE op DEFINER-RPC's).
revoke all on function public.save_recipes(uuid, jsonb) from public, anon;
grant execute on function public.save_recipes(uuid, jsonb) to authenticated;
