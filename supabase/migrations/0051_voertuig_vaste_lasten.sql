-- ============================================================================
-- HUISHOEK — 0051: Vaste lasten per voertuig (V3)
-- ============================================================================
-- Vaste lasten (verzekering, wegenbelasting, …) horen bij de auto, maar zijn gewoon
-- terugkerende uitgaven (KOS-4): ze materialiseren al als echte uitgaven in Kosten/
-- WieBetaaltWat. We koppelen ze optioneel aan een voertuig zodat het voertuig-
-- kostenoverzicht ze kan optellen. Voertuig verwijderen → koppeling los (de vaste
-- last zelf blijft bestaan; je betaalt 'm immers nog tot je 'm opzegt).
-- ============================================================================

alter table public.recurring_expenses add column if not exists vehicle_id uuid
  references public.vehicles(id) on delete set null;

create index if not exists recurring_expenses_vehicle_idx
  on public.recurring_expenses(vehicle_id) where vehicle_id is not null;
