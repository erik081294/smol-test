-- ============================================================================
-- HUISHOEK — 0040: Herhaal-einde (UX, batch 2)
-- ============================================================================
-- Een terugkerende afspraak kon alleen eindeloos doorgaan. Nu kan een herhaling
-- eindigen op een datum (recur_until) óf na een aantal beurten (recur_count).
--
-- Het doorrollen gebeurt client-side bij het afvinken (lib/useTasks.completeTask
-- via lib/recurrence.advanceRecurrence): is de einddatum gepasseerd of de teller
-- op 1, dan wordt de taak een gewone voltooiing i.p.v. door te rollen.
--   • recur_until : harde stopdatum; de volgende beurt ná deze datum vervalt.
--   • recur_count : resterende beurten (incl. de huidige), telt af bij doorrollen.
-- Beide nullable: null = geen einde (het oude, eindeloze gedrag — backward compat).
-- ============================================================================

alter table public.tasks add column if not exists recur_until date;
alter table public.tasks add column if not exists recur_count int
  check (recur_count is null or recur_count >= 1);
