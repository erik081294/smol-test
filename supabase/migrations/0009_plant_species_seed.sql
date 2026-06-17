-- ============================================================================
-- HUISHOEK — 0009: Soortdatabase seed (populaire kamer- & balkonplanten)
-- ============================================================================
-- Regelgebaseerde verzorging per soort. Start klein (~30 soorten dekken het
-- meeste); uit te breiden in latere migraties. Alleen vullen als de tabel leeg
-- is, zodat opnieuw draaien geen dubbelen maakt.
-- water_days_growing/-resting in dagen; feed_weeks_growing in weken (null = geen).
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.plant_species) then
    insert into public.plant_species
      (common_name, latin_name, water_days_growing, water_days_resting, feed_weeks_growing, light, care_notes, search)
    values
      ('Monstera', 'Monstera deliciosa', 7, 12, 4, 'halfschaduw', 'Gele blaadjes = te veel water. Geef een mosstok om te klimmen.', 'monstera deliciosa gatenplant'),
      ('Pannenkoekplant', 'Pilea peperomioides', 7, 12, 4, 'halfschaduw', 'Draai regelmatig voor gelijkmatige groei.', 'pilea pannenkoekplant peperomioides'),
      ('Vredeslelie', 'Spathiphyllum', 5, 9, 3, 'halfschaduw', 'Hangende bladeren = dorst; herstelt snel na water.', 'vredeslelie spathiphyllum lepelplant'),
      ('Sansevieria', 'Dracaena trifasciata', 14, 28, 8, 'licht', 'Bijna niet doodgaan; laat de grond goed opdrogen.', 'sansevieria vrouwentong dracaena trifasciata'),
      ('Drakenboom', 'Dracaena marginata', 10, 18, 6, 'halfschaduw', 'Bruine bladpunten bij hard water; gebruik liefst regenwater.', 'drakenboom dracaena marginata'),
      ('Ficus (Vioolblad)', 'Ficus lyrata', 7, 12, 4, 'licht', 'Houdt niet van verplaatsen; kies een vaste plek.', 'ficus lyrata vioolblad'),
      ('Ficus Benjamin', 'Ficus benjamina', 7, 12, 4, 'licht', 'Laat bladeren vallen bij stress; weer rustig.', 'ficus benjamina treurvijg'),
      ('Gatenplant Mini', 'Monstera adansonii', 6, 10, 4, 'halfschaduw', 'Houdt van klimmen en hoge luchtvochtigheid.', 'monstera adansonii apenplant'),
      ('Klimop', 'Epipremnum aureum', 7, 12, 4, 'halfschaduw', 'Zeer vergevingsgezind; snoei voor vollere groei.', 'epipremnum pothos scindapsus klimop'),
      ('Calathea', 'Calathea orbifolia', 4, 7, 4, 'halfschaduw', 'Houdt van vocht; bruine randen = te droge lucht.', 'calathea orbifolia pauwenplant'),
      ('Aloë vera', 'Aloe vera', 14, 28, 8, 'vol-zon', 'Vetplant; te veel water laat de bladeren rotten.', 'aloe vera aloë'),
      ('Cactus (bol)', 'Echinopsis', 21, 40, 8, 'vol-zon', 'In de winter koel en bijna droog houden.', 'cactus echinopsis bolcactus'),
      ('Vetplant Jade', 'Crassula ovata', 14, 28, 8, 'vol-zon', 'Rimpelige bladeren = dorst.', 'crassula ovata jade vetplant'),
      ('Echeveria', 'Echeveria', 14, 28, 8, 'vol-zon', 'Water in de rozet vermijden om rot te voorkomen.', 'echeveria vetplant'),
      ('Zamioculcas', 'Zamioculcas zamiifolia', 14, 28, 8, 'halfschaduw', 'Verdraagt schaduw en droogte; ideaal voor beginners.', 'zamioculcas zz plant'),
      ('Graslelie', 'Chlorophytum comosum', 6, 10, 4, 'halfschaduw', 'Maakt baby-plantjes die je kunt stekken.', 'chlorophytum graslelie spider plant'),
      ('Lepelplant', 'Aglaonema', 7, 12, 4, 'halfschaduw', 'Verdraagt weinig licht goed.', 'aglaonema lepelplant'),
      ('Philodendron', 'Philodendron scandens', 7, 12, 4, 'halfschaduw', 'Snelle klimmer; vergevingsgezind.', 'philodendron scandens'),
      ('Rubberplant', 'Ficus elastica', 9, 14, 5, 'licht', 'Veeg de bladeren af voor glans en gezondheid.', 'ficus elastica rubberplant'),
      ('Yucca', 'Yucca elephantipes', 12, 21, 6, 'licht', 'Laat goed opdrogen; gevoelig voor natte voeten.', 'yucca palmlelie'),
      ('Areca palm', 'Dypsis lutescens', 5, 9, 4, 'licht', 'Houdt van vochtige grond, niet kletsnat.', 'areca palm dypsis goudpalm'),
      ('Kentia palm', 'Howea forsteriana', 7, 12, 6, 'halfschaduw', 'Rustige groeier; verdraagt minder licht.', 'kentia palm howea'),
      ('Begonia', 'Begonia maculata', 5, 9, 3, 'halfschaduw', 'Stippenblad; vermijd water op de bladeren.', 'begonia maculata stippenbegonia'),
      ('Orchidee', 'Phalaenopsis', 7, 10, 4, 'halfschaduw', 'Dompelen i.p.v. gieten; wortels mogen niet in water staan.', 'orchidee phalaenopsis vlinderorchidee'),
      ('Anthurium', 'Anthurium andraeanum', 6, 10, 4, 'halfschaduw', 'Houdt van vocht en warmte; geen koude tocht.', 'anthurium flamingoplant'),
      ('Geranium', 'Pelargonium', 3, 7, 2, 'vol-zon', 'Balkonklassieker; verwijder uitgebloeide bloemen.', 'geranium pelargonium balkon'),
      ('Lavendel', 'Lavandula', 5, 12, 6, 'vol-zon', 'Houdt van droog en zonnig; snoei na de bloei.', 'lavendel lavandula balkon tuin'),
      ('Basilicum', 'Ocimum basilicum', 2, 4, 2, 'vol-zon', 'Kruid; oogst van boven zodat de plant vol blijft.', 'basilicum kruiden ocimum'),
      ('Munt', 'Mentha', 2, 5, 3, 'halfschaduw', 'Groeit hard; zet apart, woekert anders.', 'munt mentha kruiden'),
      ('Tomatenplant', 'Solanum lycopersicum', 1, 2, 1, 'vol-zon', 'Balkon/tuin; veel water en zon in de zomer.', 'tomaat tomatenplant moestuin balkon');
  end if;
end $$;
