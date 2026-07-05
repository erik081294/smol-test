-- ============================================================================
-- HUISHOEK — 0071: peek_invite-privacy (Sec-3) + bereik-CHECKs (Data-5)
-- ============================================================================
-- Twee restpunten uit het review-addendum van 2026-07-04 (REV-2):
--
--  A. Sec-3 — `peek_invite` (anon-aanroepbaar, by design: de join-preview) gaf
--     de huishoudnaam, emoji en de naam van de uitnodiger terug voor ÉLK token,
--     ongeacht status. Een ooit gelekte link (groepschat, browserhistorie)
--     bleef die info dus ook ná intrekken/verlopen/gebruiken permanent
--     onthullen. Nu: alleen een 'valid' token krijgt de preview-velden; voor
--     revoked/expired/accepted komt uitsluitend de status terug. De app
--     gebruikt de velden alleen bij status 'valid' (app/join/[token].js), dus
--     dit is gedragsneutraal voor de UI.
--
--  B. Data-5 — het bonnen-/voorraaddomein miste de bereik-CHECKs die het
--     kosten- en voertuigdomein wél hebben: negatieve prijzen of aantallen ≤ 0
--     zouden prijstracker/koopfrequentie/voorraadlogica stil vervuilen. De
--     editor klemt quantity al op ≥ 1 (Stepper min=1, `|| 1`-fallbacks) en de
--     live data is gecontroleerd schoon, dus de CHECKs valideren direct.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. peek_invite: preview-velden alleen voor een geldig token.
-- ---------------------------------------------------------------------------
create or replace function public.peek_invite(p_token text)
 returns table(household_id uuid, household_name text, household_emoji text, inviter_name text, role text, status text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  with inv as (
    select
      i.household_id,
      i.role,
      i.created_by,
      case
        when i.revoked_at is not null then 'revoked'
        when i.accepted_at is not null then 'accepted'
        when i.expires_at <= now()    then 'expired'
        else 'valid'
      end as status
    from public.household_invites i
    where i.token = p_token
  )
  select
    case when inv.status = 'valid' then h.id end,
    case when inv.status = 'valid' then h.name end,
    case when inv.status = 'valid' then h.emoji end,
    case when inv.status = 'valid' then coalesce(p.display_name, 'Iemand') end,
    case when inv.status = 'valid' then inv.role end,
    inv.status
  from inv
  join public.households h on h.id = inv.household_id
  left join public.profiles p on p.id = inv.created_by;
$function$;

-- ---------------------------------------------------------------------------
-- B. Bereik-CHECKs (idempotent; live data vooraf schoon bevonden).
-- ---------------------------------------------------------------------------
alter table public.purchases
  drop constraint if exists purchases_total_nonneg;
alter table public.purchases
  add constraint purchases_total_nonneg
  check (total_cents is null or total_cents >= 0);

alter table public.purchase_items
  drop constraint if exists purchase_items_quantity_pos;
alter table public.purchase_items
  add constraint purchase_items_quantity_pos
  check (quantity > 0);

alter table public.purchase_items
  drop constraint if exists purchase_items_cents_nonneg;
alter table public.purchase_items
  add constraint purchase_items_cents_nonneg
  check ((unit_price_cents is null or unit_price_cents >= 0)
     and (line_total_cents is null or line_total_cents >= 0));

alter table public.pantry_items
  drop constraint if exists pantry_items_quantity_nonneg;
alter table public.pantry_items
  add constraint pantry_items_quantity_nonneg
  check (quantity >= 0);

alter table public.pantry_items
  drop constraint if exists pantry_items_threshold_nonneg;
alter table public.pantry_items
  add constraint pantry_items_threshold_nonneg
  check (low_threshold is null or low_threshold >= 0);
