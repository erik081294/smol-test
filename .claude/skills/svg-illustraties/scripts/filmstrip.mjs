// filmstrip.mjs — render een animatie als reeks keyframes naast elkaar, zodat de
// BEWEGING net zo visueel te beoordelen is als een stilstaand beeld.
//
//   node filmstrip.mjs <naam> [opties]
//
//   <naam>          illustratie-naam (verplicht), bv. plants
//   --src PAD       bronbestand (default: lib/illustrations.js)
//   --type T        entrance | pulse | sway   (default entrance)
//   --frames N      aantal keyframes (default 6)
//   --out DIR       uitvoermap (default: .claude/skills/svg-illustraties/.out)
//
// De keyframes zijn een PREVIEW van de beoogde reanimated-animatie in de app —
// niet de runtime zelf. Ze laten de tussenstanden zien zodat je timing/curve en
// begin/eindstand kunt beoordelen vóór je het in reanimated giet
// (zie reference/animation.md). Easing: easeOutCubic, zoals een spring aanvoelt.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Resvg } from '@resvg/resvg-js';
import { loadModule } from './svg-bundle.mjs';

const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith('--'));
const getOpt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
if (!name) { console.error('Geef een illustratie-naam, bv: node filmstrip.mjs plants'); process.exit(1); }

const srcPath = resolve(process.cwd(), getOpt('--src', 'lib/illustrations.js'));
const outDir = resolve(process.cwd(), getOpt('--out', '.claude/skills/svg-illustraties/.out'));
const type = getOpt('--type', 'entrance');
const frames = Number(getOpt('--frames', '6'));
mkdirSync(outDir, { recursive: true });

const mod = loadModule(srcPath);
const markup = renderToStaticMarkup(createElement(mod.Illustration, { name, size: 120 }));
const inner = (markup.match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [, ''])[1];

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// per type: geef voor voortgang t (0..1) een outer transform + opacity.
// origin (60,60) = stage-midden.
function state(t) {
  const e = easeOutCubic(t);
  if (type === 'pulse') { const s = 1 + 0.06 * Math.sin(t * Math.PI); return { s, rot: 0, op: 1 }; }
  if (type === 'sway') { return { s: 1, rot: 4 * Math.sin(t * Math.PI * 2), op: 1 }; }
  // entrance (default): opveren + infaden
  return { s: 0.84 + 0.16 * e, rot: 0, op: 0.15 + 0.85 * e };
}

const cell = 120, gap = 8, labelH = 18;
const W = frames * cell + (frames - 1) * gap;
const H = cell + labelH;

const cells = Array.from({ length: frames }, (_, i) => {
  const t = frames === 1 ? 1 : i / (frames - 1);
  const { s, rot, op } = state(t);
  const ox = i * (cell + gap);
  const tf = `translate(${ox} 0) translate(60 60) scale(${s.toFixed(4)}) rotate(${rot.toFixed(3)}) translate(-60 -60)`;
  return (
    `<rect x="${ox}" y="0" width="${cell}" height="${cell}" fill="#fff" stroke="#eee"/>` +
    `<g transform="${tf}" opacity="${op.toFixed(3)}">${inner}</g>` +
    `<text x="${ox + cell / 2}" y="${cell + 13}" text-anchor="middle" ` +
      `font-family="-apple-system,Helvetica,Arial" font-size="10" fill="#5A655F">${(t * 100) | 0}%</text>`
  );
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="#fff"/>${cells}</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'width', value: W * 2 }, background: 'white' }).render().asPng();
const file = join(outDir, `_filmstrip-${name}-${type}.png`);
writeFileSync(file, png);
console.log(`✓ filmstrip → ${file}  (${type}, ${frames} frames)`);
