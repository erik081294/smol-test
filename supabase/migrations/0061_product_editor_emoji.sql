-- BOO-13 (producteditor): per-product emoji zodat een huishoud-product een eigen visueel
-- kan krijgen. lib/productImage.js (resolveProductImage) leest products.emoji al en geeft
-- het voorrang boven de categorie-emoji. Additief + nullable: bestaande rijen en
-- `select *`-queries blijven ongemoeid; de bestaande is_member-RLS (migr. 0013) dekt de
-- kolom mee, dus aanpassingen gelden huishouden-breed.
--
-- NB: in dit project is `supabase db push` kapot (history diverged); deze migratie is
-- live aangebracht via MCP apply_migration (2026-06-27). Dit bestand is de repo-spiegel.
alter table public.products add column if not exists emoji text;
