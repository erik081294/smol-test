-- HUI-2 (eigen diersoort): vrij soort-label voor pets met type 'anders'. Additief/nullable;
-- bestaande rijen/queries ongemoeid, is_member-RLS (migr. 0038) dekt de kolom mee.
--
-- NB: `supabase db push` is kapot in dit project; live aangebracht via MCP apply_migration
-- (2026-06-27). Dit bestand is de repo-spiegel.
alter table public.pets add column if not exists species_label text;
