-- ============================================================================
-- HUISHOEK — 0050: Onderhoudsboekje-foto's (V2)
-- ============================================================================
-- Het onderhoudsboekje (tijdlijn over vehicle_log) krijgt foto's, net als het
-- plantendagboek: een private bucket 'vehicles' met household-gescopete RLS
-- (eerste pad-segment = household_id), en een photo_path op vehicle_log.
-- ============================================================================

alter table public.vehicle_log add column if not exists photo_path text;

-- Private bucket (idempotent), zelfde opzet als 'plants' (0010) / 'recipes' (0034).
insert into storage.buckets (id, name, public)
values ('vehicles', 'vehicles', false)
on conflict (id) do nothing;

drop policy if exists "vehicles_photos_read" on storage.objects;
create policy "vehicles_photos_read" on storage.objects for select
  using (bucket_id = 'vehicles' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "vehicles_photos_insert" on storage.objects;
create policy "vehicles_photos_insert" on storage.objects for insert
  with check (bucket_id = 'vehicles' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "vehicles_photos_update" on storage.objects;
create policy "vehicles_photos_update" on storage.objects for update
  using (bucket_id = 'vehicles' and public.is_member( ((storage.foldername(name))[1])::uuid ));

drop policy if exists "vehicles_photos_delete" on storage.objects;
create policy "vehicles_photos_delete" on storage.objects for delete
  using (bucket_id = 'vehicles' and public.is_member( ((storage.foldername(name))[1])::uuid ));
