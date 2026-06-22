-- ============================================================================
-- HUISHOEK — 0035: Tijdlijn-notitie zonder foto (PLA-5)
-- ============================================================================
-- De plant-tijdlijn (plant_photos, migratie 0011) hield tot nu toe alleen foto's
-- bij; elke rij verlangde een photo_path. We willen ook een losse notitie kunnen
-- plaatsen ("verpot", "nieuw blad", "gele blaadjes") zónder foto.
--
-- Daarom mag photo_path nu NULL zijn: een rij met photo_path = null en een note
-- is een notitie-only tijdlijnpost. De omslagfoto (plants.photo_path) blijft
-- alleen op echte foto's gebaseerd — de app slaat notitie-rijen over bij het
-- bepalen van de cover. RLS en zichtbaarheid (erven van de parent-plant) blijven
-- ongewijzigd; dit raakt alleen de NOT NULL-constraint.
-- ============================================================================

alter table public.plant_photos
  alter column photo_path drop not null;

-- Een rij moet wél iets voorstellen: óf een foto, óf een notitie (of allebei).
-- Een lege rij (geen pad én geen tekst) heeft geen betekenis op de tijdlijn.
alter table public.plant_photos
  drop constraint if exists plant_photos_photo_or_note;
alter table public.plant_photos
  add constraint plant_photos_photo_or_note
  check (photo_path is not null or nullif(btrim(note), '') is not null);
