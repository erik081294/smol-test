-- BOO-13 (producteditor, foto): per-product foto. Spiegelt het recepten-patroon (0034):
-- private bucket 'product-images' met household-gescopete RLS (eerste pad-segment =
-- household_id, <household_id>/<product_id>/<key>.<ext>), toegang via public.is_member.
-- products.photo_path verwijst naar het opslag-object; de app toont 'm via een signed URL.
-- Additief: nieuwe kolom (nullable), nieuwe bucket, nieuwe policies — bestaande data en
-- policies blijven ongemoeid. Aanpassingen gelden huishouden-breed (is_member-RLS).
--
-- NB: `supabase db push` is kapot in dit project (history diverged); live aangebracht via
-- MCP apply_migration (2026-06-27). Dit bestand is de repo-spiegel.
alter table public.products add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

drop policy if exists "product_images_read" on storage.objects;
create policy "product_images_read" on storage.objects for select
  using ( bucket_id = 'product-images' and public.is_member( ((storage.foldername(name))[1])::uuid ) );

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects for insert
  with check ( bucket_id = 'product-images' and public.is_member( ((storage.foldername(name))[1])::uuid ) );

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects for update
  using ( bucket_id = 'product-images' and public.is_member( ((storage.foldername(name))[1])::uuid ) );

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects for delete
  using ( bucket_id = 'product-images' and public.is_member( ((storage.foldername(name))[1])::uuid ) );
