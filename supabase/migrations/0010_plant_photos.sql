-- ============================================================================
-- HUISHOEK — 0010: Plantfoto's (Supabase Storage)
-- ============================================================================
-- Een private bucket 'plants'. Het eerste pad-segment is het household_id, zodat
-- de toegang met dezelfde is_member-regel gescoped kan worden als de rest van de
-- app:  <household_id>/<plant_id>.jpg
--
-- We bewaren in plants.photo_path het pad (zonder bucket); de app haalt een
-- signed URL op om de foto te tonen (de bucket is bewust niet publiek).
-- ============================================================================

-- Bucket aanmaken (idempotent).
insert into storage.buckets (id, name, public)
values ('plants', 'plants', false)
on conflict (id) do nothing;

-- Helper-uitdrukking: het household_id uit het eerste mapsegment van de naam.
-- storage.foldername('<hh>/<plant>.jpg') => {'<hh>'}, dus [1] is het household_id.

-- Lezen: leden van het huishouden waarvan het pad start.
drop policy if exists "plants_photos_read" on storage.objects;
create policy "plants_photos_read" on storage.objects for select
  using (
    bucket_id = 'plants'
    and public.is_member( ((storage.foldername(name))[1])::uuid )
  );

-- Schrijven (upload).
drop policy if exists "plants_photos_insert" on storage.objects;
create policy "plants_photos_insert" on storage.objects for insert
  with check (
    bucket_id = 'plants'
    and public.is_member( ((storage.foldername(name))[1])::uuid )
  );

-- Vervangen (upsert).
drop policy if exists "plants_photos_update" on storage.objects;
create policy "plants_photos_update" on storage.objects for update
  using (
    bucket_id = 'plants'
    and public.is_member( ((storage.foldername(name))[1])::uuid )
  );

-- Verwijderen.
drop policy if exists "plants_photos_delete" on storage.objects;
create policy "plants_photos_delete" on storage.objects for delete
  using (
    bucket_id = 'plants'
    and public.is_member( ((storage.foldername(name))[1])::uuid )
  );
