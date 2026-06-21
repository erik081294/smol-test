-- ============================================================================
-- HUISHOEK — 0034: recept-omslagfoto's (Supabase Storage) — MLT-3
-- ============================================================================
-- `recipes.photo_path` bestaat al (0016) maar er was nooit een bucket. Deze migratie
-- maakt de private bucket 'recipes' met dezelfde household-gescopete RLS als 'plants'
-- (0010): het eerste pad-segment is het household_id (<household_id>/<recipe_id>.<ext>),
-- en toegang loopt via public.is_member(...). De app toont de foto via een signed URL.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('recipes', 'recipes', false)
on conflict (id) do nothing;

drop policy if exists "recipes_photos_read" on storage.objects;
create policy "recipes_photos_read" on storage.objects for select
  using ( bucket_id = 'recipes' and public.is_member( ((storage.foldername(name))[1])::uuid ) );

drop policy if exists "recipes_photos_insert" on storage.objects;
create policy "recipes_photos_insert" on storage.objects for insert
  with check ( bucket_id = 'recipes' and public.is_member( ((storage.foldername(name))[1])::uuid ) );

drop policy if exists "recipes_photos_update" on storage.objects;
create policy "recipes_photos_update" on storage.objects for update
  using ( bucket_id = 'recipes' and public.is_member( ((storage.foldername(name))[1])::uuid ) );

drop policy if exists "recipes_photos_delete" on storage.objects;
create policy "recipes_photos_delete" on storage.objects for delete
  using ( bucket_id = 'recipes' and public.is_member( ((storage.foldername(name))[1])::uuid ) );
