# `docs/` — index

Wegwijzer voor deze map. Drie soorten document — let op het verschil:

- **Naslag / how-to** = levend, blijft kloppen; volg het.
- **Runbook** = herhaalrecept (draaien telkens als er iets bijkomt).
- **Gedateerde snapshot** = eenmalige analyse op een datum; **geen statustracker**.
  De actuele status leeft uitsluitend in [`huishoek-backlog.md`](../huishoek-backlog.md) §6.

> Status, roadmap en build-historie staan **niet** hier — zie de oriëntatie-map in
> [`CLAUDE.md`](../CLAUDE.md) (status = backlog §6, logboek = `huishoek-voortgang.md`).

## Naslag / how-to (levend)

| Document | Waarover |
|----------|----------|
| [`architectuur.md`](./architectuur.md) | De module-ruggengraat (`modules.js` → `useCollection` → `enable_module_rls`) + de gedeelde entity-editor — het contract dat elke module modulair houdt. |
| [`mutatietesten.md`](./mutatietesten.md) | Mutatietesten & de effectiviteit-ratchet — praktische gids + baseline-workflow. |
| [`zichtbaarheid.md`](./zichtbaarheid.md) | Het zichtbaarheidscontract (`can_view`, `visibility`/`share_*`) dat elke datamodule deelt. |
| [`eas-setup.md`](./eas-setup.md) | EAS Android dev build & release — quickstart (hoort bij plan 08). |
| [`notify-setup.md`](./notify-setup.md) | Notificaties opzetten (PLT-1) — lokale herinneringen + push. |
| [`recurring-setup.md`](./recurring-setup.md) | Terugkerende uitgaven server-side materialiseren (KOS-4). |
| [`orq-receipt-scan.md`](./orq-receipt-scan.md) | Bonscan via Orq.ai (BOO-7) — edge function `scan-receipt` setup. |
| [`off-catalog.md`](./off-catalog.md) | Productcatalogus uit Open Food Facts vullen/vers houden — operator-runbook. |

## Runbook

| Document | Waarover |
|----------|----------|
| [`rooktest.md`](./rooktest.md) | Geautomatiseerde device-rooktest — `npm run rooktest` (Maestro-flows + logcat-oordeel), zie ook [`../.maestro/README.md`](../.maestro/README.md). |
| [`../VERIFICATIE.md`](../VERIFICATIE.md) | Migratie-/RLS-verificatie tegen live Supabase — herhaalrecept per nieuwe migratie. |
| [`rls-connector-check.sql`](./rls-connector-check.sql) | RLS-/RPC-check zonder secrets (plak-en-run in de SQL Editor). |

## Build-ready plannen

| Document | Waarover |
|----------|----------|
| [`plans/00-overzicht.md`](./plans/00-overzicht.md) | Index + ontwerp-onderbouwing van alle implementatieplannen (01–19). **Geen status** — die leeft in backlog §6. |

## Gedateerde snapshots (eenmalig, historisch — geen status)

| Document | Datum | Waarover |
|----------|-------|----------|
| [`verbeterplan-modules-2026-06-30.md`](./verbeterplan-modules-2026-06-30.md) | 2026-06-30 | **Verbeterplan** Voertuigen/Bonnen/Catalogus — bevindingen uit de twee reviews hieronder, élk tegen de code geverifieerd (gefixt / beslissing / groter werk / non-issue). Opvolging: §6 **UXR-11**. |
| [`ux-review-modules-2026-06-30.md`](./ux-review-modules-2026-06-30.md) | 2026-06-30 | Onafhankelijke UX/interactie-review (subagent) van Voertuigen/Bonnen/Catalogus-screenshots — 12 punten, [zeker]/[aanname]-getagd. |
| [`visual-design-review-2026-06-30.md`](./visual-design-review-2026-06-30.md) | 2026-06-30 | Onafhankelijke puur-visuele review (subagent) van dezelfde modules — kleur-rolzuiverheid, hiërarchie, consistentie. |
| [`ux-review-rooktest-2026-06-30.md`](./ux-review-rooktest-2026-06-30.md) | 2026-06-30 | Onafhankelijke UX/product-review van de drie-sporen-rooktest (SCH-4/PLA-10/BOO-14..17) — 14 geprioriteerde punten. Opvolging: backlog §6 **UXR-10**. |
| [`design-review-2026-06-26.md`](./design-review-2026-06-26.md) | 2026-06-26 | Design-review per scherm (rooktest-screenshots) + getierd verbeterplan (quick wins → herontwerpen). |
| [`launch-readiness-2026-06-26.md`](./launch-readiness-2026-06-26.md) | 2026-06-26 | Launch-readiness review (5 parallelle agents) richting ~10.000 gebruikers. |
| [`test-effectiviteit-2026-06-22.md`](./test-effectiviteit-2026-06-22.md) | 2026-06-22 | Mutatietest-rapport — cijfers per module (achtergrond bij `mutatietesten.md`). |
| [`security-review-ai-2026-06-21.md`](./security-review-ai-2026-06-21.md) | 2026-06-21 | Security review / threat model voor AI-assisted development. |
| [`audit-2026-06-21.md`](./audit-2026-06-21.md) | 2026-06-21 | Architectuur-, security- & performance-audit van de codebase. |
