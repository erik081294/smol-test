// Uitleg-content per module — de tekst achter de "Hoe werkt dit?"-explainer in de
// kop van elke module (zie ModuleHelpButton in lib/ui.js). Eén rustige ingang die
// een drawer opent met: waarvóór is deze module, en hoe werkt 'ie.
//
// Bewust een eigen, PURE data-module (geen React/native imports) — net als
// lib/palette.js en de category-labels in lib/theme.js. De app is nl-only, dus de
// tekst staat hier inline i.p.v. via lib/i18n.js; komt er een tweede taal, dan
// verhuist dit mee. Sleutel = de module-key uit lib/modules.js.
//
// Let op: Nederlandse weglatingstekens als typografische apostrof (') — net als in
// lib/i18n.js (bv. 'foto's') — zodat de string-delimiter (') niet breekt.
//
// Vorm per item:
//   title  — kop van de drawer (de modulenaam zoals de gebruiker 'm kent)
//   intro  — één warme zin: waarvoor is dit
//   points — 2-4 korte "zo werkt het"-puntjes (geen jargon, gewone taal)

export const moduleHelp = {
  vandaag: {
    title: 'Thuis',
    intro: 'Je startpunt: in één blik zie je wat er vandaag te doen is.',
    points: [
      'Bovenaan staan de taken voor vandaag en wat achterstallig is — vink ze hier meteen af.',
      'De ring laat zien hoe ver de dag is; vol = alles gedaan.',
      'De tegels eronder stel je zelf samen: houd een tegel even vast om te verslepen, vergroten of weghalen.',
    ],
  },
  taken: {
    title: 'Taken',
    intro: 'Alles wat er in huis moet gebeuren, op één lijst.',
    points: [
      'Tik op + om een taak of afspraak toe te voegen, met een datum en eventueel een herhaling.',
      'Veeg een taak naar rechts om uit te stellen, naar links om te verwijderen.',
      'Een gedeelde taak ziet iedereen in het huishouden — en iedereen kan het afvinken.',
    ],
  },
  inzichten: {
    title: 'Inzichten',
    intro: 'Hoe het huishouden ervoor staat, in grafieken.',
    points: [
      'Zie trends in taken, kosten en voorraad over de tijd.',
      'Handig om samen terug te kijken: wie deed wat, en waar ging het geld heen.',
    ],
  },
  boodschappen: {
    title: 'Boodschappen',
    intro: 'Eén lijst die het hele huishouden deelt.',
    points: [
      'Voeg producten toe via de catalogus, of typ snel iets nieuws.',
      'Vink af in de winkel — iedereen ziet de lijst meteen bijwerken.',
      'Producten onthouden hun schap, zodat je lijst zich naar de winkelvolgorde sorteert.',
    ],
  },
  schoonmaak: {
    title: 'Schoonmaak',
    intro: 'Terugkerende klusjes die het huis fris houden.',
    points: [
      'Plan een klus met een ritme (wekelijks, maandelijks) en hij komt vanzelf terug.',
      'Afvinken zet het meteen klaar voor de volgende keer.',
    ],
  },
  kosten: {
    title: 'Kosten',
    intro: 'Wie betaalt wat — eerlijk verdeeld, zonder gedoe.',
    points: [
      'Voeg een uitgave toe en kies wie meebetaalt; de app rekent de verdeling uit.',
      'De groene balk bovenaan toont jouw saldo: krijg je nog, of moet je nog.',
      '"Bekijk vereffening" zegt precies wie wie wat moet overmaken om quitte te staan.',
    ],
  },
  planten: {
    title: 'Planten',
    intro: 'Op tijd water, op maat verzorgd.',
    points: [
      'Voeg een plant toe en krijg meteen een verzorgingsschema (water, voeding, licht).',
      'Verzorgingstaken verschijnen vanzelf op je takenlijst als ze aan de beurt zijn.',
      'In de tijdlijn leg je de groei in beeld vast.',
    ],
  },
  huisdieren: {
    title: 'Huisdieren',
    intro: 'Voeren, verzorgen en bijhouden — samen.',
    points: [
      'Voeg een huisdier toe en stel een verzorgingsschema voor (voeren, uitlaten, dierenarts).',
      'Wie net gevoerd heeft, vinkt het af zodat niemand het dubbel doet.',
      'In de tijdlijn bewaar je momentjes en aantekeningen.',
    ],
  },
  voertuigen: {
    title: 'Voertuigen',
    intro: 'Onderhoud plannen en bijhouden.',
    points: [
      'Voeg een voertuig toe; merk en model haalt de app op bij het kenteken.',
      'Plan onderhoud (APK, beurt, banden) en zie wat er als volgende aankomt.',
      'Deel je de auto via Samen, dan is hij reserveerbaar en deelbaar in kosten.',
    ],
  },
  tijdlijn: {
    title: 'Tijdlijn',
    intro: 'Het prikbord van je huishouden.',
    points: [
      'Plaats een bericht: een foto, een mededeling of een momentje.',
      'Iedereen in het huishouden ziet het en kan reageren.',
    ],
  },
  maaltijden: {
    title: 'Keuken',
    intro: 'Plan je week en beheer je recepten.',
    points: [
      'Vul per dag een maaltijd in — kies een recept of typ er een.',
      'Bij Recepten bewaar je je vaste recepten met porties en ingrediënten.',
      'Ingrediënten van een geplande maaltijd zet je in één tik op de boodschappenlijst.',
    ],
  },
  voorraad: {
    title: 'Voorraad',
    intro: 'Wat er in huis is, en wat bijna op is.',
    points: [
      'Houd bij wat in de kast en koelkast staat.',
      'Raakt iets op, dan zet je het met één tik op de boodschappenlijst.',
    ],
  },
  delen: {
    title: 'Samen',
    intro: 'Spullen die je samen gebruikt of uitleent.',
    points: [
      'Zet een gedeeld item klaar (gereedschap, de auto, een logeerkamer) om te reserveren.',
      'Zo zie je wie wat wanneer gebruikt, zonder appjes heen en weer.',
    ],
  },
};
