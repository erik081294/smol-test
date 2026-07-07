# Plan 28 — Werksessie-agenda juli (vervolg op plan 27)

> **Wat dit is:** de concrete sessie-indeling voor de komende weken, gekozen door Erik
> (2026-07-06, sessie-review op de laatste PRs). Het *hoe* per onderdeel staat al in
> [plan 27](27-ontwikkelprogramma-juli.md) (golven, tabellen, migratienummer-rationale) —
> dit doc herhaalt dat niet, het sequencet alleen en vult twee dingen aan die plan 27
> niet heeft: de uitgewerkte **Golf 0-checklist** en een **INF-4 Sentry-mini-plan**.
> Status blijft uitsluitend in backlog §6 leven.
>
> **Scope-delta t.o.v. plan 27:** de **security-staart (SEC-6/SEC-7/REV-2 P8-P9) is
> bewust geparkeerd** (Erik-keuze 2026-07-06; blijft als Next-rijen in §6 staan) en
> **INF-4 (Sentry) is toegevoegd** — buiten plan 27, maar Next-baan en de Sentry-MCP
> is al aan de dev-omgeving gekoppeld.

## Voorwaarde: PR #127 landen

Alles hieronder stapelt op de golf-branch van PR #127 (AI-16 r1+r2, AI-19 fase A,
PLT-3/PLT-8, TML-4/6, plan 26/27; CI + ratchet groen; migraties 0075–0077 en edge v18
al live). **Advies-volgorde t.o.v. de parallelle ratchet-optimalisatie-sessie:**
merge #127 éérst en rebase de ratchet-sessie daarna op de nieuwe main. Rationale:
baseline-/ratchet-werk is her-afleidbaar uit de bron (conflict in
`reports/mutation/mutation-baseline.json` los je op door de baseline opnieuw te
genereren, niet door getallen hand-te-mergen); de golf-branch van 30+ bestanden is dat
niet. Een grote groene PR laten rijpen naast een tweede actieve sessie is het echte
conflictrisico.

## Sessie-agenda

| # | Sessie | Items | Bron (het *hoe*) | Waarom hier |
|---|--------|-------|------------------|-------------|
| 0 | **Device-verificatie-avond** (Erik + moto) | ~15× 🔧 → ✅ | checklist hieronder | 🔧-cap (~10) is overschreden; de-risket alles wat volgt |
| 1 | **AI-kwaliteitsborging** | AI-20 | plan 27 golf 1a | QA vóór tool-expansie (harde volgorde-regel uit plan 27) |
| 2 | **AI-overal fase B: write-tools** | AI-19 | plan 27 golf 2a | Vijf HITL-writes + het tool-budget-beslispunt bij ~20 tools |
| 3 | **Catalogus-matching** | AI-11 | plan 27 golf 2b | Onafhankelijk; propose-side matching + async categoriseren |
| 4 | **Klein-werk-avond** | PLT-7-staart + INF-4 | plan 27 golf 3b + mini-plan hieronder | Twee S-klussen gebundeld tot één sessie |
| 5 | **Geheugen v1** | AI-9 | plan 24 ronde H via plan 27 golf 4a | Migratienummer: eerstvolgend vrij — live verifiëren via MCP `list_migrations` (0075–0077 zijn bezet) |
| 6 | **Gen-UI ronde 3** | AI-16 | plan 27 golf 4b | Ná AI-11: de bredere choice-node toont dan catalogus-matches |
| 7 | **Documentenkluis** | DOC-1 | plan 27 "doorlopend/dedicated" | Nieuwe module, AI-inclusief vanaf dag één (`documenten_zoeken`) |
| 8 | **i18n/ui-splitsing** (dedicated) | ARCH-4 | plan 27 "doorlopend/dedicated" | Gedragsneutraal; kan elk moment tussen sessies, maar nooit gemengd met feature-werk |

Afhankelijkheden: 0 → 1 → 2 zijn de enige harde ketens; 3/4/5 zijn onderling vrij;
6 wil ná 3; 7 wil bij voorkeur ná 2 (dan liggen de tool-factory-patronen vast); 8 is
een losse, dedicated sessie — plan 'm als "pauze-nummer" tussen twee feature-sessies.

## Golf 0 — checklist device-verificatie-avond (moto, licht + donker)

Per bevestigd blok: rij in §6 op ✅ → archief mét notitie. Vooraf: `npm run rooktest`
(vangt regressies + de 5 Maestro-flows in één klap).

**Assistent — gen-UI (AI-16/AI-18):**
- [ ] Kosten-vraag → `chart` verschijnt; tik op een balk toont de week-inspectie
- [ ] Weekmenu-vraag → `schedule`-rooster met álle dagen (incl. gaten), "vandaag" gemarkeerd
- [ ] ≥2 recept-treffers → `choice`-kaart; tik = gewone gebruikersbeurt (zichtbaar in het gesprek)
- [ ] Recept-kaart: porties-stepper herrekent ingrediënten live (client-lokaal)
- [ ] Voorstel bevestigen → **vervolg-beurt** verschijnt (kort, logische vervolgstap, verzint niets)
- [ ] "Akkoord met alles" bij ≥2 voorstellen → één vervolg-beurt, stopt bij eerste fout
- [ ] Alles hierboven één keer in donker thema herhalen

**Assistent — acties & beheer:**
- [ ] AI-15: "vink melk af" → HITL-kaart → item afgevinkt in Boodschappen → undo werkt
- [ ] AI-17: owner zet `ai:write` uit voor een lid → schrijf-tools weg voor dat lid; weer aan → terug
- [ ] AI-19 fase A spot-check: `planten_overzicht` (verzorg-schedule) + voertuig-vraag (TCO-keyvalue/chart)

**Platform (nieuw in #127):**
- [ ] PLT-3: zoeken via "Meer" → hit tikken → juiste detail-route (check ook een RLS-gescheiden term: privé-item van ander lid mag níét verschijnen)
- [ ] PLT-8: uitloggen → inloggen met e-mail-OTP-code (nieuw account: naam-scherm verschijnt) — vereist dat de Supabase-dashboard-stap (email-OTP + template) gedaan is
- [ ] PLT-7: join-e2e web → app; 🎉-scherm-staat beoordelen (store-links-stub)
- [ ] TML-4: comment plaatsen op een bericht; zichtbaarheid erft van de post
- [ ] TML-6: filter (module/event-type) aan/uit → lijst verandert; instelling overleeft herstart

## INF-4 — Sentry-mini-plan (sessie 4)

Klein en additief; geen plan-27-golf. Doel: fouten uit productie zien i.p.v. raden.

1. **App:** `@sentry/react-native` (Expo-config-plugin, SDK 56-route), DSN via
   `EXPO_PUBLIC_SENTRY_DSN`; init in `app/_layout.js`; de bestaande `ErrorBoundary`
   meldt door via `Sentry.captureException`. Geen PII: user-context beperken tot
   gehashte ids (zelfde discipline als de Orq-trace-metadata).
2. **Edge:** `assistant`/`scan-receipt` vangen al fouten — voeg een Sentry-DSN-fetch
   toe in de catch-paden (Deno `fetch` naar de store-endpoint of `sentry/deno`),
   fail-silent (monitoring mag nooit een request breken).
3. **Verificatie:** één bewust gegooide testfout app + edge → zichtbaar in Sentry
   (de Sentry-MCP in de dev-omgeving kan de issue direct opvragen); daarna de
   testfout verwijderen. Release-tagging kan later met INF-5 (EAS) meeliften.

## Definition of done

Ongewijzigd: CLAUDE.md + de per-golf-DoD in plan 27 (ratchet, unit-test per export,
typecheck, volledige suite, docs in dezelfde PR, migraties via MCP + advisor +
RLS-scenario, eval-gate bij tool/prompt-wijzigingen, edge-deploy met byte-verificatie).
