// Pure grid-engine voor de Vandaag-widget-grid (VDG-2). Geen React.
//
// Een "layout" is een geordende lijst plaatsingen: [{ key, size }] — een widget-key
// (uit de registry) plus de gekozen grootte. De engine berekent posities, leidt een
// default-layout af uit de ingeschakelde modules, en herschikt (pure transform voor
// de latere bewerkmodus). Door React eruit te houden is dit volledig unit-testbaar.

// Grootte → kolom-/rij-span. 1×1 = halve breedte (telefoon, 2 koloms), 2×1 = vol,
// 2×2 = vol en dubbel hoog.
export const WIDGET_SPANS = {
  '1x1': { w: 1, h: 1 },
  '2x1': { w: 2, h: 1 },
  '2x2': { w: 2, h: 2 },
};

export function spanFor(size) {
  return WIDGET_SPANS[size] ?? WIDGET_SPANS['1x1'];
}

// Plaats de widgets in leesvolgorde in een grid van `cols` kolommen, links→rechts
// met wrapping (zoals flex-wrap, maar berekend zodat het te testen is).
//  -> [{ key, size, col, row, w, h }]
export function packGrid(placed, { cols = 2 } = {}) {
  const cells = [];
  let row = 0;
  let col = 0;
  for (const item of placed ?? []) {
    if (!item || !item.key) continue;
    const { w, h } = spanFor(item.size);
    const width = Math.min(w, cols);
    if (col + width > cols) { row += 1; col = 0; } // past niet meer op deze rij → wrap
    cells.push({ key: item.key, size: item.size, col, row, w: width, h });
    col += width;
    if (col >= cols) { row += 1; col = 0; }
  }
  return cells;
}

// Default-layout uit de ingeschakelde module-keys (in volgorde): per module zijn
// default-widget. `defaultsByModule` mapt module-key → descriptor ({ key, defaultSize }),
// als dependency-injection zodat deze kern puur blijft (de echte registry leeft in
// lib/widgets/registry.js en importeert React).
export function deriveDefaultLayout(moduleKeys, defaultsByModule = {}) {
  const out = [];
  for (const key of moduleKeys ?? []) {
    const d = defaultsByModule[key];
    if (d && d.key) out.push({ key: d.key, size: d.defaultSize ?? '1x1' });
  }
  return out;
}

// Verplaats de widget met `key` naar `toIndex` (pure herschik-transform).
export function moveWidget(layout, key, toIndex) {
  const arr = [...(layout ?? [])];
  const from = arr.findIndex((x) => x.key === key);
  if (from === -1) return arr;
  const [item] = arr.splice(from, 1);
  const idx = Math.max(0, Math.min(toIndex, arr.length));
  arr.splice(idx, 0, item);
  return arr;
}

// Voeg een widget toe (achteraan) als die er nog niet staat; verwijder op key.
export function addWidget(layout, key, size = '1x1') {
  if ((layout ?? []).some((x) => x.key === key)) return layout ?? [];
  return [...(layout ?? []), { key, size }];
}

export function removeWidget(layout, key) {
  return (layout ?? []).filter((x) => x.key !== key);
}

// Wissel de grootte van een widget (cyclisch door zijn toegestane groottes).
export function resizeWidget(layout, key, sizes) {
  return (layout ?? []).map((x) => {
    if (x.key !== key || !sizes?.length) return x;
    const i = sizes.indexOf(x.size);
    return { ...x, size: sizes[(i + 1) % sizes.length] };
  });
}
