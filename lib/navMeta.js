// @ts-check
// Navigatie-metadata voor het "vorige"-lintje (UX-10). Puur en unit-testbaar.
//
// Een detailscherm (modal-stack onder app/) sluit met een naamloze ✕; je ziet niet
// wáár je naar terugkeert. Dit koppelt elke detail-route aan de module (tab) waar
// 'ie logisch bij hoort, zodat de terug-knop de herkomst toont ("‹ Boodschappen").
// Sluit aan op UX-12 (back vanuit een via "Meer" geopende tab keert naar Meer).

import { getModule } from './modules';

// Detail-route-sleutel → module-key van de herkomst-tab.
export const DETAIL_PARENT = {
  plant: 'planten',
  'plant-timeline': 'planten',
  pet: 'huisdieren',
  purchase: 'boodschappen',
  purchases: 'boodschappen',
  product: 'boodschappen',
  catalog: 'boodschappen',
  recipe: 'maaltijden',
  resource: 'delen',
  expense: 'kosten',
  'recurring-expense': 'kosten',
  'kosten-inzichten': 'kosten',
  task: 'taken',
  herinneringen: 'huishouden',
  beeldstijl: 'huishouden',
};

// Het zichtbare label voor de terug-knop van een detailscherm. `fromKey` (optioneel,
// bijv. uit een ?from=-param) overschrijft de statische parent voor schermen die
// vanaf méér plekken open kunnen. Geeft null als er geen herkomst bekend is → de
// caller valt dan terug op de naamloze ✕.
export function backLabelFor(routeKey, fromKey) {
  const key = fromKey || DETAIL_PARENT[routeKey];
  return getModule(key)?.label ?? null;
}
