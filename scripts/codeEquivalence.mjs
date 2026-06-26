// Bepaalt of twee JS-bronversies dezelfde UITVOERBARE code hebben — los van comments,
// JSDoc, type-casts en opmaak. Gebruikt door de mutatie-ratchet (scripts/mutation-check.mjs)
// om modules waarin alléén commentaar/opmaak veranderde NIET nodeloos opnieuw te muteren.
//
// Waarom: de ratchet bepaalt "gewijzigde modules" via `git diff --name-only`, dat een
// comment-only wijziging (bv. een `// @ts-check`-sweep over alle modules) niet kan
// onderscheiden van echte code. Dat triggerde een volledige her-mutatie van álle modules
// en daarmee flaky timeout-ruis (zie docs/mutatietesten.md / mutation-baseline-pitfalls).
//
// Aanpak: parse + her-genereer met Babel ZÓNDER comments en met genormaliseerde opmaak.
// We passen GEEN projecttransformatie toe (configFile/babelrc:false) — puur parse → print,
// zodat alleen verschillen in de daadwerkelijke code overblijven.
import { transformSync } from '@babel/core';

// Genormaliseerde vorm van een bronbestand: zonder comments, met canonieke opmaak.
export function normalizeCode(code) {
  const result = transformSync(code, {
    configFile: false,
    babelrc: false,
    comments: false,
    compact: false,
    sourceType: 'unambiguous',
    parserOpts: { plugins: ['jsx'] },
    generatorOpts: { shouldPrintComment: () => false },
  });
  return result?.code ?? '';
}

// True als twee bronversies dezelfde uitvoerbare code hebben (alleen comments/opmaak
// verschillen). Bij een parse-fout: conservatief false — dan behandelen we het als een
// echte wijziging en muteren we de module gewoon (liever onnodig testen dan iets missen).
export function isBehaviorallyEqual(codeA, codeB) {
  try {
    return normalizeCode(codeA) === normalizeCode(codeB);
  } catch {
    return false;
  }
}
