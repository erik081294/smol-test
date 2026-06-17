// Design tokens voor Huishoek.
// Identiteit: "thuis" — diepgroen als basis, warm oker als accent.
// Rustig, huiselijk, maar strak genoeg om dagelijks te gebruiken.

export const colors = {
  // Basis
  bg:        '#F5F2EC',   // warm zandwit
  surface:   '#FFFFFF',
  surfaceAlt:'#EDE8DE',

  // Merk
  forest:    '#0E3A2F',   // diepgroen — koppen, navigatie
  forestSoft:'#1C5446',
  ocher:     '#E0A53D',   // accent — acties, highlights
  ocherSoft: '#F6E4BE',

  // Tekst
  ink:       '#1A2420',
  inkSoft:   '#5A655F',
  inkFaint:  '#9AA39D',

  // Functioneel
  line:      '#E2DDD2',
  done:      '#7BA893',
  danger:    '#C0573B',

  // Categorie-accenten
  catKlus:       '#E0A53D',
  catHuishouden: '#6B8FB5',
  catPlant:      '#7BA893',
  catAfspraak:   '#B5739E',
  catOverig:     '#9AA39D',
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export const spacing = (n) => n * 4;

export const font = {
  // System fonts; in productie kun je een display-face laden (bv. Fraunces).
  display: undefined,
  body: undefined,
};

export const type = {
  h1:    { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h2:    { fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  title: { fontSize: 17, fontWeight: '600', color: colors.ink },
  body:  { fontSize: 15, fontWeight: '400', color: colors.ink },
  label: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  caption:{ fontSize: 12, fontWeight: '500', color: colors.inkFaint },
};

export const categoryMeta = {
  klus:       { label: 'Klusje',     emoji: '🔧', color: colors.catKlus },
  huishouden: { label: 'Huishouden', emoji: '🧹', color: colors.catHuishouden },
  plant:      { label: 'Plant',      emoji: '🪴', color: colors.catPlant },
  afspraak:   { label: 'Afspraak',   emoji: '📅', color: colors.catAfspraak },
  overig:     { label: 'Overig',     emoji: '📌', color: colors.catOverig },
};
