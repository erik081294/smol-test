// A11y-contrast-borging (PLT-5): legt de AA-drempels van de kerntoken-paren vast in
// beide thema's. Breekt een palette-wijziging het contrast (zoals de dark-mode-titels
// in UX-14), dan faalt dit. Drempels: AA-tekst 4.5, AA-groot/UI 3.0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, AA_TEXT, AA_LARGE } from '../lib/contrast.js';
import { lightColors, darkColors } from '../lib/palette.js';

const atLeast = (fg, bg, min, label) => {
  const r = contrastRatio(fg, bg);
  assert.ok(r >= min, `${label}: contrast ${r.toFixed(2)} < ${min}`);
};

test('contrastRatio: exacte WCAG-uitersten — zwart/wit = 21, symmetrisch, gelijk = 1', () => {
  const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  // Zwart (lum 0) op wit (lum 1): (1 + 0.05) / (0 + 0.05) = 21 — pint beide +0.05-constanten.
  approx(contrastRatio('#000000', '#ffffff'), 21);
  approx(contrastRatio('#ffffff', '#000000'), 21); // symmetrisch (Math.max/Math.min-keuze)
  // Gelijke kleur → ratio exact 1 (zou NaN worden als een +0.05 wegviel: 0/0).
  assert.equal(contrastRatio('#000000', '#000000'), 1);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
});

for (const [theme, c] of [['licht', lightColors], ['donker', darkColors]]) {
  test(`contrast (${theme}): primaire/secundaire tekst haalt AA op bg én surface`, () => {
    for (const surf of [c.bg, c.surface]) {
      atLeast(c.ink, surf, AA_TEXT, `${theme} ink op ${surf}`);
      atLeast(c.inkSoft, surf, AA_TEXT, `${theme} inkSoft op ${surf}`);
    }
  });

  test(`contrast (${theme}): tertiaire tekst (inkFaint) haalt ten minste UI/groot (3:1)`, () => {
    // Meta/placeholder — bewust lichter dan body; minimaal de 3:1-vloer.
    atLeast(c.inkFaint, c.bg, AA_LARGE, `${theme} inkFaint op bg`);
    atLeast(c.inkFaint, c.surface, AA_LARGE, `${theme} inkFaint op surface`);
  });

  test(`contrast (${theme}): tekst op forest (onDark) en titels (h1=ink) leesbaar`, () => {
    atLeast(c.onDark, c.forest, AA_TEXT, `${theme} onDark op forest`);
    // De UX-14-regressie: titels gebruiken ink; check tegen bg.
    atLeast(c.ink, c.bg, AA_TEXT, `${theme} titel(ink) op bg`);
  });

  test(`contrast (${theme}): soft-badge fg op zijn tint-bg haalt de UI/groot-vloer (3:1)`, () => {
    // Soft-badges zijn korte, bold accent-labels op hun eigen tint; AA-groot/UI (3:1)
    // is hun bar (volle 4.5 zou het hele status-palet moeten verduisteren). Deze vloer
    // ving de brand-badge bij ~2.1 (UX-14) en bewaakt 'm tegen terugzakken.
    atLeast(c.success, c.successSoft, AA_LARGE, `${theme} success`);
    atLeast(c.warning, c.warningSoft, AA_LARGE, `${theme} warning`);
    atLeast(c.danger, c.dangerSoft, AA_LARGE, `${theme} danger`);
    atLeast(c.info, c.infoSoft, AA_LARGE, `${theme} info`);
    atLeast(c.brandText, c.forestTint, AA_LARGE, `${theme} brand`);
  });

  // NB: categorie-accenten worden NIET als tekst-contrast getest. Het zijn warme
  // identiteitskleuren voor het categorie-icoon (decoratief); op wit halen ze geen
  // tekstcontrast. De categorie wordt altijd óók met een leesbaar label getoond
  // (inkSoft, AA) — kleur is dus redundant, nooit het enige signaal (PLT-5/DESIGN.md).

  test(`contrast (${theme}): toast-tekst op toast-bg haalt AA-tekst`, () => {
    atLeast(c.toastText, c.toastBg, AA_TEXT, `${theme} toast`);
  });

  test(`contrast (${theme}): kenteken-plaatje (donkere tekst op ocher) haalt AA-tekst`, () => {
    // Badge tone="plate" — een geel NL-plaatje met hardgecodeerde donkere tekst
    // (#1A2420), bewust thema-onafhankelijk. Borgt dat het op ocher leesbaar blijft.
    atLeast('#1A2420', c.ocher, AA_TEXT, `${theme} kenteken-plaatje`);
  });
}
