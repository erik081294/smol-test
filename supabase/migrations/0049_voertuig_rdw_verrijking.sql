-- ============================================================================
-- HUISHOEK — 0049: RDW-verrijking op voertuigen (V1)
-- ============================================================================
-- De RDW open data (m9d7-ebf2) levert naast merk/model/type ook kleur, carrosserie,
-- APK-vervaldatum, datum eerste toelating, catalogusprijs en massa. We bewaren die
-- als overschrijfbare velden op het voertuig: ze voeden de fun-factor (kleur/carrosserie
-- → autootje in beeld), de échte APK-datum (i.p.v. "+1 jaar"), en straks de
-- afschrijving-/kostenschatting (catalogusprijs + leeftijd, massa voor wegenbelasting).
-- Alles optioneel: ontbreekt het bij de RDW, dan blijft het null en valt de UI terug.
-- ============================================================================

alter table public.vehicles add column if not exists color              text;
alter table public.vehicles add column if not exists body_type          text;  -- RDW 'inrichting'
alter table public.vehicles add column if not exists apk_expires_on     date;
alter table public.vehicles add column if not exists first_registration date;
alter table public.vehicles add column if not exists catalog_price_cents int
  check (catalog_price_cents is null or catalog_price_cents >= 0);
alter table public.vehicles add column if not exists curb_weight_kg     int
  check (curb_weight_kg is null or curb_weight_kg >= 0);
