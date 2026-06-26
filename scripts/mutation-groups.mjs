// Pure data: welke logica-modules de mutatietest dekt, gegroepeerd per testfile.
//
// Bewust LOS van scripts/mutation.mjs (die `@stryker-mutator/core` importeert): zo kunnen
// de unit-tests deze lijst inlezen (tests/groupsCoverage.test.js bewaakt de dekking) zonder
// dat élke `npm test`-run de zware Stryker-modulegraaf meetrekt. mutation.mjs her-exporteert
// hieronder zodat bestaande imports (`from './mutation.mjs'`) blijven werken.
//
// Per groep: { test, srcs, exclude? }.
//   - test:    basisnaam van tests/<test>.test.js
//   - srcs:    bronbestanden die deze test geacht wordt af te dekken
//   - exclude: mutators die voor deze groep ruis opleveren (zie i18n: vertaaldata)
//
// Bewust NIET gemuteerd: React-gekoppelde lagen (lib/use*.js, lib/ui.js, schermen,
// componenten) — die hebben geen unit-tests en zouden alleen "survived" ruis geven.
// De RLS-integratietest vereist secrets/egress en valt buiten pure logica.
export const GROUPS = [
  { test: 'activity', srcs: ['lib/activity.js'] },
  { test: 'agenda', srcs: ['lib/agenda.js'] },
  { test: 'appRoute', srcs: ['lib/appRoute.js'] },
  { test: 'barcode', srcs: ['lib/barcode.js'] },
  { test: 'buyFrequency', srcs: ['lib/buyFrequency.js'] },
  { test: 'choreLibrary', srcs: ['lib/choreLibrary.js'] },
  { test: 'cleaningTemplates', srcs: ['lib/cleaningTemplates.js'] },
  { test: 'dataCache', srcs: ['lib/dataCache.js'] },
  { test: 'decisions', srcs: ['lib/decisions.js'] },
  { test: 'expenses', srcs: ['lib/expenses.js'] },
  { test: 'fairness', srcs: ['lib/fairness.js'] },
  { test: 'favoriteGroceries', srcs: ['lib/favoriteGroceries.js'] },
  // Gedeelde formulier-validatie van de entity-editors (ARCH-1, docs/architectuur.md).
  // Pure regel-runner; de schermen leunen erop voor hun foutmeldingen → ratchet-bewaakt.
  { test: 'formValidation', srcs: ['lib/formValidation.js'] },
  // i18n.js is grotendeels vertaaldata; StringLiteral-mutaties daarop zijn ruis.
  { test: 'i18n', srcs: ['lib/i18n.js'], exclude: ['StringLiteral'] },
  { test: 'insights', srcs: ['lib/insights.js'] },
  { test: 'invites', srcs: ['lib/invites.js'] },
  { test: 'mealPlan', srcs: ['lib/mealPlan.js'] },
  { test: 'modules', srcs: ['lib/modules.js'] },
  { test: 'navMeta', srcs: ['lib/navMeta.js'] },
  { test: 'notifications', srcs: ['lib/notifications.js'] },
  { test: 'offCatalog', srcs: ['lib/offCatalog.js'] },
  { test: 'offDelta', srcs: ['lib/offDelta.js'] },
  { test: 'pantry', srcs: ['lib/pantry.js'] },
  { test: 'pendingDeletes', srcs: ['lib/pendingDeletes.js'] },
  { test: 'plantCare', srcs: ['lib/plantCare.js'] },
  { test: 'plantPhoto', srcs: ['lib/plantPhoto.js'] },
  { test: 'plantTimeline', srcs: ['lib/plantTimeline.js'] },
  { test: 'priceTrack', srcs: ['lib/priceTrack.js'] },
  { test: 'productMatch', srcs: ['lib/productMatch.js'] },
  { test: 'realtimePatch', srcs: ['lib/realtimePatch.js'] },
  { test: 'recurrence', srcs: ['lib/recurrence.js'] },
  { test: 'recurringExpense', srcs: ['lib/recurringExpense.js'] },
  { test: 'reservations', srcs: ['lib/reservations.js'] },
  { test: 'rotation', srcs: ['lib/rotation.js'] },
  { test: 'timeline', srcs: ['lib/timeline.js'] },
  { test: 'visibility', srcs: ['lib/visibility.js'] },
  // offCategoryMap.js is een token-regeltabel (data); StringLiteral-mutaties op die
  // tokens zijn ruis — de test dekt de match-LOGICA + representatieve mappings, niet
  // elk los token. Zelfde redenering als i18n.
  { test: 'catalogCategory', srcs: ['lib/offCategoryMap.js'], exclude: ['StringLiteral'] },
  { test: 'constants-sync', srcs: ['lib/constants.js'] },
  // groceryCatalog.js is grotendeels een data-tabel (productnamen/emoji's); StringLiteral-
  // mutaties daarop zijn ruis, zelfde redenering als i18n. De helper-LOGICA wordt wél gemuteerd.
  { test: 'groceryCatalog', srcs: ['lib/groceryCatalog.js'], exclude: ['StringLiteral'] },
  // recipeCatalog.js is grotendeels een taxonomie-tabel (labels/emoji's); StringLiteral-
  // mutaties daarop zijn data-ruis (zelfde redenering als groceryCatalog). De filter-LOGICA
  // wordt wél gemuteerd.
  { test: 'recipeCatalog', srcs: ['lib/recipeCatalog.js'], exclude: ['StringLiteral'] },
  { test: 'productImage', srcs: ['lib/productImage.js'] },
  { test: 'quantity', srcs: ['lib/quantity.js'] },
  { test: 'groceryCount', srcs: ['lib/groceryCount.js'] },
  { test: 'groceryList', srcs: ['lib/groceryList.js'] },
  { test: 'widgets', srcs: ['lib/widgets/grid.js', 'lib/widgets/summaries.js'] },
  // colorSchemes.js is een kleur/stijl-datatabel; StringLiteral = hex/kleurnamen (data).
  { test: 'widgets', srcs: ['lib/widgets/colorSchemes.js'], exclude: ['StringLiteral'] },
  { test: 'notify', srcs: ['supabase/functions/notify/core.js'] },
  { test: 'scanReceipt', srcs: ['supabase/functions/scan-receipt/core.js'] },
  // Voertuig- + geld-laag (V3 "TCO") en huisdier/heatmap/contrast: pure logica met een
  // unit-test die tot dusver buiten de ratchet viel (audit-bevinding). Nu wél bewaakt —
  // begin bij de geld-modules (vehicleCosts berekent kosten/km; vehicleSharing verdeelt).
  { test: 'vehicleCosts', srcs: ['lib/vehicleCosts.js'] },
  { test: 'vehicleSharing', srcs: ['lib/vehicleSharing.js'] },
  { test: 'vehicleCare', srcs: ['lib/vehicleCare.js'] },
  { test: 'vehicleTimeline', srcs: ['lib/vehicleTimeline.js'] },
  { test: 'vehicleAppearance', srcs: ['lib/vehicleAppearance.js'] },
  { test: 'rdw', srcs: ['lib/rdw.js'] },
  { test: 'petCare', srcs: ['lib/petCare.js'] },
  { test: 'yearHeatmap', srcs: ['lib/yearHeatmap.js'] },
  { test: 'contrast', srcs: ['lib/contrast.js'] },
  // Hadden een unit-test maar vielen tot dusver buiten de ratchet (drift-bevinding):
  // realtimeHub (pub/sub-hub) en secureStorage (pure chunk-/byte-logica; de native schil
  // is lazy en blijft NoCoverage). De GROUPS-dekkingscheck (tests/groupsCoverage.test.js)
  // bewaakt nu dat geteste modules niet meer stil aan de mutatie ontsnappen.
  { test: 'realtimeHub', srcs: ['lib/realtimeHub.js'] },
  { test: 'secureStorage', srcs: ['lib/secureStorage.js'] },
];

// Alle muteerbare bronbestanden (voor het mappen van gewijzigde bestanden → groepen).
export const MUTATED_SOURCES = [...new Set(GROUPS.flatMap((g) => g.srcs))];

// Testfiles die BEWUST geen mutatiegroep hebben (zie tests/groupsCoverage.test.js):
//   - perfAggregates: dekt aggregatie ín expenses + fairness, die hun eigen groep hebben.
//   - rls.integration: integratietest tegen live Supabase (secrets/egress), geen pure logica.
//   - groupsCoverage: meta-test op deze lijst zelf, geen lib-module om te muteren.
//   - typecheckCoverage: meta-test op de type-laag (// @ts-check + tsconfig.check.json),
//     geen lib-module om te muteren.
//   - codeEquivalence: test op de gedrags-equivalentie-helper van de ratchet zelf
//     (scripts/codeEquivalence.mjs), geen lib-module om te muteren.
export const UNMUTATED_TESTS = ['perfAggregates', 'rls.integration', 'groupsCoverage', 'typecheckCoverage', 'codeEquivalence'];

// Selecteer groepen op een substring-filter (naam of bron). Lege filter = alles.
export function selectGroups(filter) {
  if (!filter) return GROUPS;
  return GROUPS.filter((g) => g.test.includes(filter) || g.srcs.some((s) => s.includes(filter)));
}
