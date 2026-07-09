---
name: pr-en-dod
description: Van codewijziging naar gemergde PR in deze repo. Gebruik deze skill bij het openen, pushen of mergen van een PR, bij rode CI, bij mutatie-ratchet/baseline-problemen, en bij vragen over de definition of done. Trefwoorden: PR, push, merge, CI, DoD, definition of done, mutatie, baseline, branch protection, lint.
---

# Van wijziging naar gemergde PR

De definition of done staat in [CLAUDE.md](../../../CLAUDE.md); deze skill is het uitvoerings-recept
met de valkuilen die ons eerder merge-rondes hebben gekost. Volg de stappen in volgorde.

## 0. Omgeving

In sommige sessies (kale sandbox) staan `node`/`npm`/`gh` niet op de default PATH
(nvm-install). Geeft een commando "command not found", prefix dan met:

```bash
export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:/opt/homebrew/bin:$PATH"
```

## 1. Branch — nooit direct op main

`main` is branch-protected: directe pushes worden geweigerd. Al het werk gaat via branch + PR.
De CI-check `test` is required én `strict: true` (branch moet up-to-date zijn met main vóór merge).

## 2. Checks — draai exact wat CI draait, in deze volgorde

CI (`.github/workflows/ci.yml`) draait: `npx eslint .` → `npm run typecheck` → `npm test`,
plus een aparte `mutation`-job. Lokaal verifiëren:

```bash
npx eslint .                                          # ⚠️ NIET `expo lint`/`npm run lint`
npm run typecheck
npm test
node scripts/mutation-check.mjs --since=origin/main   # alleen bij gewijzigde lib/*-modules
```

**Lint-valkuil:** CI draait `npx eslint .`; `expo lint` geeft níét hetzelfde resultaat (dit
kostte ons een merge-blokkade: "expo lint → 0 errors" terwijl CI op 3 errors faalde). Vuurt
een react-compiler/react-hooks-regel als *error* op een idiomatisch RN/Reanimated-patroon,
downgrade die regel dan consistent naar `warn` in `eslint.config.js` (de correctheids-regels
`no-undef`/`no-unused-vars`/`jsx-no-undef` blijven error).

**Mutatie-ratchet:**
- Raakte je een module uit de `GROUPS`-lijst in `scripts/mutation-groups.mjs`? Dan moet de
  ratchet groen vóór de PR — niet ontdekken ná de merge.
- Survivors bekijken: `node scripts/mutation.mjs <module>` → `reports/mutation/mutation.json`.
  De terugkerende dodings-patronen (grenswaarde, volgorde, null-fallback, default-param,
  equivalente mutant) staan in CLAUDE.md en `docs/mutatietesten.md`. Mik op ~85%, geen 100%.
- **Stale-baseline-valkuil:** `mutation-baseline.json` moet tegen de FINALE code zijn
  gegenereerd. Herijk vlak vóór de PR (`npm run test:mutation:baseline`), niet mid-sessie —
  anders claimt de baseline scores die de eindcode niet haalt en zakt CI.
- **Timeout-ruis-valkuil (`lib/vehicleTimeline.js`):** Stryker telt timeouts als killed, dus de
  score schommelt met machinebelasting (lokaal 80%, CI 74%). Laat die baseline conservatief op
  de CI-vloer staan; pin alleen load-onafhankelijke kills hard vast.

**Testplicht:** elke nieuwe `export function` in `lib/*.js` krijgt een unit-test in dezelfde PR.

## 3. Docs-sync vóór de merge

Verschuift een feit dat een doc beweert (migratie live, test groen, feature verscheept)?
Werk backlog §6 bij in dezelfde PR; bevestigde ✅'s naar het archief. Verifieer status altijd
tegen de bron (MCP `list_migrations`, de test-run), nooit tegen een overgetypt nummer in een doc.

## 4. Push & PR

Alleen het `erik081294`-account heeft write-access (de andere gh-accounts krijgen 403):

```bash
gh auth switch --user erik081294
git push -u origin <branch>
gh pr create --title "..." --body "..."
gh pr merge <n> --merge --auto     # wacht netjes op de required check `test`
```

git gebruikt gh als credential helper — het account switchen is genoeg. De historie gebruikt
merge-commits (geen squash).

## 5. Meerdere PR's in één ronde mergen

Door `strict: true` gaat na elke merge elke andere open PR BEHIND — dit is inherent sequentieel:

```bash
gh pr update-branch <n>
gh pr checks <n> --watch --interval 20
gh pr merge <n> --merge
```

Gestapelde PR's worden NIET auto-geretarget als hun base merget. `gh pr edit --base` kan stil
falen; gebruik REST: `gh api -X PATCH repos/erik081294/smol-test/pulls/<n> -f base=main`.
Faalt de required check door iets dat níét in jouw wijziging zit, meld dat dan aan de gebruiker
en laat de keuze hoe verder aan hem — nooit zelf om CI heen mergen.
