// render.mjs — maak van een react-native-svg illustratiebron beoordeelbare PNG's.
//
//   node render.mjs [bron] [opties]
//
//   bron            pad naar het illustratie-bestand (default: lib/illustrations.js
//                   t.o.v. de huidige werkmap)
//   --out DIR       uitvoermap (default: .claude/skills/svg-illustraties/.out)
//   --names a,b,c   alleen deze illustraties (default: alle)
//   --scale N       schaal voor losse PNG's (default 4 → 480px voor 120-canvas)
//   --grid          overlay een uitlijn-grid (10px) + middenlijnen op het contactvel
//   --no-sheet      sla het contactvel over
//   --only-sheet    render alleen het contactvel
//
// Output: <out>/<naam>.png per illustratie + <out>/_contactvel.png (overzicht).
// De pipeline rendert de ECHTE component (via svg-bundle.mjs), niet een kopie,
// dus wat je ziet is exact wat de app toont.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Resvg } from '@resvg/resvg-js';
import { loadModule } from './svg-bundle.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const getOpt = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
// eerste niet-vlag-arg die niet de waarde van een --opt is, is de bron
const optValues = new Set(['--out', '--names', '--scale'].map((k) => getOpt(k)).filter(Boolean));
const srcArg = argv.find((a) => !a.startsWith('--') && !optValues.has(a));

const srcPath = resolve(process.cwd(), srcArg || 'lib/illustrations.js');
const outDir = resolve(process.cwd(), getOpt('--out', '.claude/skills/svg-illustraties/.out'));
const scale = Number(getOpt('--scale', '4'));
const onlyNames = getOpt('--names', '').split(',').map((s) => s.trim()).filter(Boolean);

mkdirSync(outDir, { recursive: true });

// ── bron laden & illustraties → SVG ───────────────────────────────────────────
const mod = loadModule(srcPath);
const Illustration = mod.Illustration;
const names = (onlyNames.length ? onlyNames : mod.ILLUSTRATION_NAMES) || [];
if (!Illustration || !names.length) {
  console.error('Geen Illustration-export of namen gevonden in', srcPath);
  process.exit(1);
}

function svgFor(name) {
  const markup = renderToStaticMarkup(createElement(Illustration, { name, size: 120 }));
  const m = markup.match(/<svg[\s\S]*<\/svg>/);
  if (!m) throw new Error(`Geen <svg> in render van "${name}"`);
  return m[0];
}

function rasterize(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'white' })
    .render().asPng();
}

const svgs = {};
for (const name of names) svgs[name] = svgFor(name);

// ── losse PNG's ───────────────────────────────────────────────────────────────
if (!flags.has('--only-sheet')) {
  for (const name of names) {
    writeFileSync(join(outDir, `${name}.png`), rasterize(svgs[name], 120 * scale));
  }
}

// ── contactvel ────────────────────────────────────────────────────────────────
if (!flags.has('--no-sheet')) {
  const cols = Math.min(4, names.length);
  const rows = Math.ceil(names.length / cols);
  const cell = 120, padX = 16, labelH = 22, padY = 12;
  const cw = cell + padX * 2;
  const ch = cell + padY + labelH;
  const W = cols * cw, H = rows * ch;

  const grid = (ox, oy) =>
    !flags.has('--grid') ? '' :
    Array.from({ length: 13 }, (_, i) => i * 10).map((g) =>
      `<line x1="${ox + g}" y1="${oy}" x2="${ox + g}" y2="${oy + cell}" stroke="#000" stroke-width="0.4" opacity="0.06"/>` +
      `<line x1="${ox}" y1="${oy + g}" x2="${ox + cell}" y2="${oy + g}" stroke="#000" stroke-width="0.4" opacity="0.06"/>`
    ).join('') +
    `<line x1="${ox + 60}" y1="${oy}" x2="${ox + 60}" y2="${oy + cell}" stroke="#d00" stroke-width="0.5" opacity="0.35"/>` +
    `<line x1="${ox}" y1="${oy + 60}" x2="${ox + cell}" y2="${oy + 60}" stroke="#d00" stroke-width="0.5" opacity="0.35"/>`;

  const cells = names.map((name, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const ox = c * cw + padX, oy = r * ch + padY / 2;
    const inner = svgs[name].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    return (
      `<g transform="translate(${ox} ${oy})">` +
        `<rect x="0" y="0" width="${cell}" height="${cell}" fill="none" stroke="#eee" stroke-width="1"/>` +
        grid(0, 0) + inner +
      `</g>` +
      `<text x="${ox + cell / 2}" y="${oy + cell + 15}" text-anchor="middle" ` +
        `font-family="-apple-system,Helvetica,Arial" font-size="11" fill="#5A655F">${name}</text>`
    );
  }).join('');

  const sheet =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>${cells}</svg>`;
  writeFileSync(join(outDir, '_contactvel.png'), rasterize(sheet, W * 2));
}

console.log(`✓ ${names.length} illustratie(s) → ${outDir}`);
console.log(names.map((n) => `  ${n}`).join('\n'));
